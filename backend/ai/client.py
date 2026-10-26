"""Meta AI model client: justification summaries, title simplification, and
structured requirement extraction from tender specification text.

Targets api.meta.ai's Responses API (confirmed live 2026-10-26 — not the
OpenAI-compatible chat/completions shape some other Meta/Llama endpoints
use): POST {base_url}/responses with {model, instructions, input: [...],
text: {format: {...}}}. The response's `output` list mixes a "reasoning"
item with a "message" item; the actual text is in the message item's
content[0].text.

Every prompt instructs the model to justify rather than decide, and to say
so rather than invent an answer when the source text doesn't say. Extraction
is schema-constrained (text.format=json_object + Pydantic validation), with
up to 3 attempts; if the model still won't produce valid JSON, the caller
gets a result with extraction_confidence="failed" and the raw text attached
for manual review, instead of an exception breaking the pipeline.
"""

import json

import httpx
from pydantic import BaseModel, ValidationError
from tenacity import retry, retry_if_exception_type, stop_after_attempt

from core.config import settings
from models.company import CompanyProfile
from models.tender import Tender

JUSTIFY_SYSTEM_PROMPT = """\
You are a public-procurement advisor helping an SME decide whether a \
tender is worth pursuing. You never make the go/no-go call yourself — \
only the company does. Given the tender summary and the company profile \
below, write a {language} justification of 2-3 sentences: why this tender \
does or doesn't look like a fit, and what the company should specifically \
verify itself (experience threshold, turnover requirement, certifications, \
deadline, lot structure). If something isn't stated in the data you were \
given, say that it's unclear and must be checked — never invent a fact \
that isn't there."""

SIMPLIFY_TITLE_SYSTEM_PROMPT = """\
Rewrite the given public-tender title in {language} so a non-native \
speaker instantly understands what the work is. Rules:
- Never translate or drop project/reference codes (e.g. "E-24-A027", \
"SMIS 300079") — keep every one of them, verbatim, if there are several.
- Never translate street/village/company/institution names.
- Well-known city/region names may be localized (e.g. "București" -> \
"Bucharest"); small settlement names may not.
- Translate only descriptive/procedural words.
- Quoted project names are not exempt from translation just because \
they're quoted.
- Output only the rewritten title, nothing else."""

EXTRACT_SYSTEM_PROMPT = """\
Extract structured eligibility requirements from the given public-tender \
specification text. Only extract what the text literally states — do not \
infer, round, or guess a number that isn't there. Anything missing or \
ambiguous goes in `uncertain_points` instead of being filled in. Respond \
with ONLY a JSON object matching this schema, no other text:

{schema}"""


class ExtractedRequirements(BaseModel):
    minimum_annual_turnover: float | None = None
    turnover_currency: str | None = None
    similar_experience_years: int | None = None
    required_certifications: list[str] = []
    guarantee_amount: float | None = None
    guarantee_currency: str | None = None
    other_requirements: list[str] = []
    uncertain_points: list[str] = []
    extraction_confidence: str = "medium"  # "high" | "medium" | "low" | "failed"
    raw_model_output: str | None = None


class MetaAIClient:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self.model = settings.meta_model
        self._client = client or httpx.AsyncClient(
            base_url=settings.meta_api_base_url,
            headers={"Authorization": f"Bearer {settings.meta_api_key}"},
            timeout=60.0,
        )

    @retry(stop=stop_after_attempt(3), retry=retry_if_exception_type(httpx.HTTPError))
    async def _chat(self, system_prompt: str, user_message: str, *, json_mode: bool = False) -> str:
        payload = {
            "model": self.model,
            "instructions": system_prompt,
            "input": [{"role": "user", "content": [{"type": "input_text", "text": user_message}]}],
            "reasoning": {"effort": "low"},  # these are short, well-defined tasks, not open-ended
            "stream": False,
        }
        if json_mode:
            payload["text"] = {"format": {"type": "json_object"}}

        response = await self._client.post("/responses", json=payload)
        response.raise_for_status()
        data = response.json()
        return _extract_output_text(data)

    async def summarize_justification(
        self, tender_summary: str, company_profile_summary: str, *, language: str = "en"
    ) -> str:
        system_prompt = JUSTIFY_SYSTEM_PROMPT.format(language=language)
        user_message = f"Tender:\n{tender_summary}\n\nCompany profile:\n{company_profile_summary}"
        return (await self._chat(system_prompt, user_message)).strip()

    async def simplify_title(self, title: str, *, language: str = "en") -> str:
        system_prompt = SIMPLIFY_TITLE_SYSTEM_PROMPT.format(language=language)
        return (await self._chat(system_prompt, title)).strip()

    async def extract_requirements(self, specification_text: str) -> ExtractedRequirements:
        schema = json.dumps(ExtractedRequirements.model_json_schema())
        system_prompt = EXTRACT_SYSTEM_PROMPT.format(schema=schema)

        last_raw: str | None = None
        for _ in range(3):
            raw = await self._chat(system_prompt, specification_text, json_mode=True)
            last_raw = raw
            try:
                return ExtractedRequirements.model_validate(json.loads(raw))
            except (json.JSONDecodeError, ValidationError):
                continue

        return ExtractedRequirements(extraction_confidence="failed", raw_model_output=last_raw)


def _extract_output_text(data: dict) -> str:
    for item in data.get("output", []):
        if item.get("type") == "message":
            for part in item.get("content", []):
                if part.get("type") == "output_text":
                    return part.get("text", "")
    raise ValueError(f"No message/output_text found in response: {data}")


def build_tender_summary(tender: Tender) -> str:
    value = f"{tender.estimated_value:,.0f} {tender.currency}" if tender.estimated_value else "not stated"
    deadline = tender.submission_deadline.isoformat() if tender.submission_deadline else "not stated"
    return (
        f"Title: {tender.title}\n"
        f"Contracting authority: {tender.contracting_authority or 'not stated'}\n"
        f"Main CPV: {tender.cpv_codes[0] if tender.cpv_codes else 'not stated'}\n"
        f"Estimated value: {value}\n"
        f"Submission deadline: {deadline}"
    )


def build_company_summary(profile: CompanyProfile) -> str:
    return (
        f"Name: {profile.name}\n"
        f"Core CPV codes (bids as sole contractor): {', '.join(profile.cpv_codes) or 'none listed'}\n"
        f"Secondary CPV codes (subcontracting interest): "
        f"{', '.join(profile.secondary_cpv_codes) or 'none listed'}\n"
        f"Certifications: {', '.join(profile.certifications) or 'none listed'}\n"
        f"Reference value ceiling for sole-contractor work: "
        f"{profile.annual_capacity or 'not stated'}"
    )
