"""Meta AI model client: justification summaries, title simplification,
structured requirement extraction from tender specification text, and
vision transcription of scanned pages.

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

import base64
import json

import httpx
from pydantic import BaseModel, ValidationError
from tenacity import retry, retry_if_exception_type, stop_after_attempt

from backend.ai.safety import UNTRUSTED_RULE, clean_output, clean_text, wrap_untrusted
from backend.core.config import settings
from backend.models.company import CompanyProfile
from backend.models.tender import Tender

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

TRANSLATE_SYSTEM_PROMPT = """\
You receive a Romanian public-tender title and, sometimes, a description. \
Reply with ONLY a JSON object: {{"title": "...", "summary": "..."}}.
- "title": the title in plain English so a foreign contractor instantly \
understands the work. Keep every project/reference code verbatim, never \
translate street/village/company/institution names, and localise only \
well-known places (e.g. "București" -> "Bucharest").
- "summary": one or two plain English sentences saying what is being bought \
or built and, if the text says so, where. Use only what the given text \
states; never invent a quantity, price, date or requirement."""

EXTRACT_SYSTEM_PROMPT = """\
Extract structured eligibility requirements from the given public-tender \
specification text. Only extract what the text literally states — do not \
infer, round, or guess a number that isn't there. Anything missing or \
ambiguous goes in `uncertain_points` instead of being filled in.

`minimum_annual_turnover` and `similar_experience_minimum_value` are \
DIFFERENT numbers that public tenders commonly state side by side — do \
not confuse them. `minimum_annual_turnover` is a requirement on the \
company's own yearly revenue. `similar_experience_minimum_value` is the \
cumulative value of similar contracts the company must have already \
completed (usually phrased as "lucrări/servicii similare ... valoare \
cumulată ... minim X lei", over a lookback period and across at most N \
past contracts) — it is about past track record, not current turnover.

Every currency field must be an ISO 4217 code (e.g. "RON", "EUR"), never \
the source text's own word for it — e.g. Romanian "lei" is the currency \
named RON, so output "RON", not "lei".

Respond with ONLY a JSON object matching this schema, no other text:

{schema}"""

OCR_SYSTEM_PROMPT = """\
Transcribe the text visible in the image exactly, preserving the \
original language (usually Romanian), line breaks, numbers, and units. \
Do not translate, summarize, or add anything that isn't there. If the \
page contains no readable text, output nothing."""

BRIEF_SYSTEM_PROMPT = """\
You brief a contractor who is deciding whether to bid on a public tender \
worth a lot of money. You get the notice and, when available, text of its \
specification documents (caiet de sarcini, fisa de date). Write the brief \
in {language}. Be concrete and specific so they can judge the job without \
reading the files: name the actual work, quantities, capacities, materials, \
standards, phases and constraints exactly as the text gives them.

Hard rules: use ONLY what the text states. Never invent or round a number, \
date, quantity or requirement. If something a bidder would want to know is \
not in the text, list it under "not_stated" instead of guessing. Keep \
project/reference codes, street, village and institution names verbatim. \
Keep every item to one short sentence. No marketing language.

Respond with ONLY a JSON object matching this schema, no other text:

{schema}"""

COMPARE_ELIGIBILITY_SYSTEM_PROMPT = """\
You are a public-procurement eligibility checker for an SME. You are \
given the tender's extracted requirements, some already-computed numeric \
checks, and the company's profile. Produce a concrete eligibility \
verdict:
- `eligible`: true if the company clearly meets every requirement you can \
check, false if it clearly fails at least one, or null if there isn't \
enough data to say either way. Only use null when genuinely undecidable \
from the given data — don't default to null to avoid committing.
- `matched_requirements` / `unmet_requirements`: short, specific items \
(e.g. "Similar-experience value: company has 5,200,000 RON vs required \
4,000,000 RON — met"), one per requirement you could evaluate.
- `justification`: 2-3 sentences explaining the verdict and naming \
anything the company must still verify itself (anything marked uncertain \
below, or any requirement — e.g. a named certification — this process \
can't verify from free text alone).
Never invent a company capability or a requirement that wasn't given to \
you. Respond with ONLY a JSON object matching this schema, no other text:

{schema}"""


class ExtractedRequirements(BaseModel):
    minimum_annual_turnover: float | None = None
    turnover_currency: str | None = None
    similar_experience_years: int | None = None
    # Cumulative value of similar past contracts required, and the max
    # number of contracts allowed to add up to it — distinct from
    # minimum_annual_turnover, see EXTRACT_SYSTEM_PROMPT.
    similar_experience_minimum_value: float | None = None
    similar_experience_minimum_value_currency: str | None = None
    similar_experience_max_contracts: int | None = None
    required_certifications: list[str] = []
    guarantee_amount: float | None = None
    guarantee_currency: str | None = None
    other_requirements: list[str] = []
    uncertain_points: list[str] = []
    extraction_confidence: str = "medium"  # "high" | "medium" | "low" | "failed"
    raw_model_output: str | None = None


class BriefCondition(BaseModel):
    label: str
    value: str


class TenderBrief(BaseModel):
    """Plain-language read of what a tender asks for; an empty field means
    the source text does not say."""

    overview: str = ""  # 2-4 sentences: what is built/bought, where, for whom
    scope: list[str] = []  # work items / deliverables with quantities and capacities
    method: list[str] = []  # how: technical solutions, standards, materials, phases
    conditions: list[BriefCondition] = []  # duration, place, warranty, payment, guarantee, award criterion, lots
    watch_outs: list[str] = []  # what to check before committing: risks, tight dates, penalties
    not_stated: list[str] = []  # what a bidder would want to know that the text omits


class EligibilityVerdict(BaseModel):
    eligible: bool | None = None  # None = genuinely undecidable, never a default
    matched_requirements: list[str] = []
    unmet_requirements: list[str] = []
    justification: str = ""


def _record_usage(model: str, purpose: str, usage: object) -> None:
    """Store the provider's token counts for this call. Never raises: a logging
    problem must not break the feature that made the call."""
    try:
        from sqlmodel import Session

        from backend.db import engine
        from backend.models.ai_usage import AiUsage

        if not isinstance(usage, dict):
            return
        details_out = usage.get("output_tokens_details") or {}
        details_in = usage.get("input_tokens_details") or {}
        row = AiUsage(
            purpose=purpose,
            model=model,
            input_tokens=int(usage.get("input_tokens") or 0),
            output_tokens=int(usage.get("output_tokens") or 0),
            reasoning_tokens=int(details_out.get("reasoning_tokens") or 0),
            cached_tokens=int(details_in.get("cached_tokens") or 0),
        )
        with Session(engine) as session:
            session.add(row)
            session.commit()
    except Exception:  # noqa: BLE001
        pass


class MetaAIClient:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self.model = settings.meta_model
        self._client = client or httpx.AsyncClient(
            base_url=settings.meta_api_base_url,
            headers={"Authorization": f"Bearer {settings.meta_api_key}"},
            timeout=60.0,
        )

    @retry(stop=stop_after_attempt(3), retry=retry_if_exception_type(httpx.HTTPError))
    async def _chat(
        self,
        system_prompt: str,
        user_message: str,
        *,
        json_mode: bool = False,
        images: list[bytes] | None = None,
        purpose: str = "other",
        wrap: bool = True,
    ) -> str:
        # Outside text goes in as marked data; every system prompt says how to treat it.
        system_prompt = system_prompt + UNTRUSTED_RULE
        content: list[dict] = [{"type": "input_text", "text": wrap_untrusted(user_message) if wrap else user_message}]
        for png in images or []:
            b64 = base64.b64encode(png).decode()
            content.append({"type": "input_image", "image_url": f"data:image/png;base64,{b64}"})
        payload = {
            "model": self.model,
            "instructions": system_prompt,
            "input": [{"role": "user", "content": content}],
            "reasoning": {"effort": "low"},  # these are short, well-defined tasks, not open-ended
            "stream": False,
        }
        if json_mode:
            payload["text"] = {"format": {"type": "json_object"}}

        response = await self._client.post("/responses", json=payload)
        response.raise_for_status()
        data = response.json()
        _record_usage(self.model, purpose, data.get("usage"))
        return _extract_output_text(data)

    async def summarize_justification(
        self, tender_summary: str, company_profile_summary: str, *, language: str = "en"
    ) -> str:
        system_prompt = JUSTIFY_SYSTEM_PROMPT.format(language=language)
        user_message = f"Tender:\n{tender_summary}\n\nCompany profile:\n{company_profile_summary}"
        return (await self._chat(system_prompt, user_message, purpose="justification")).strip()

    async def simplify_title(self, title: str, *, language: str = "en") -> str:
        system_prompt = SIMPLIFY_TITLE_SYSTEM_PROMPT.format(language=language)
        return (await self._chat(system_prompt, title, purpose="simplify_title")).strip()

    async def translate_tender(self, title: str, description: str | None) -> tuple[str, str] | None:
        """English title + short summary, or None when the model's answer is unusable."""
        user_message = f"Title: {title}"
        if description:
            user_message += f"\n\nDescription: {description[:1500]}"
        for _ in range(2):
            raw = await self._chat(TRANSLATE_SYSTEM_PROMPT, user_message, json_mode=True, purpose="translate")
            try:
                data = json.loads(raw)
                title_en, summary = clean_text(str(data["title"]), 300), clean_text(str(data["summary"]), 700)
            except (json.JSONDecodeError, KeyError, TypeError):
                continue
            if title_en and summary:
                return title_en, summary
        return None

    async def build_brief(self, source_text: str, *, language: str = "English") -> TenderBrief | None:
        """Structured brief from notice/specification text, or None when the answer is unusable."""
        schema = json.dumps(TenderBrief.model_json_schema())
        system_prompt = BRIEF_SYSTEM_PROMPT.format(language=language, schema=schema)
        for _ in range(2):
            raw = await self._chat(system_prompt, source_text, json_mode=True, purpose=f"brief:{language}")
            try:
                brief = TenderBrief.model_validate(clean_output(json.loads(raw), 600))
            except (json.JSONDecodeError, ValidationError):
                continue
            if brief.overview.strip():
                return brief
        return None

    async def ocr_image(self, png_bytes: bytes, *, hint: str = "Transcribe this page:") -> str:
        """Transcribe one rendered page image via the model's vision input.
        Same Responses API contract and retry policy as the text steps —
        no extra provider or API key."""
        return (await self._chat(OCR_SYSTEM_PROMPT, hint, images=[png_bytes], purpose="ocr")).strip()

    async def extract_requirements(self, specification_text: str) -> ExtractedRequirements:
        schema = json.dumps(ExtractedRequirements.model_json_schema())
        system_prompt = EXTRACT_SYSTEM_PROMPT.format(schema=schema)

        last_raw: str | None = None
        for _ in range(3):
            raw = await self._chat(system_prompt, specification_text, json_mode=True, purpose="extract")
            last_raw = raw
            try:
                return ExtractedRequirements.model_validate(clean_output(json.loads(raw), 600))
            except (json.JSONDecodeError, ValidationError):
                continue

        return ExtractedRequirements(extraction_confidence="failed", raw_model_output=last_raw)

    async def compare_eligibility(
        self, extracted: ExtractedRequirements, numeric_checks: str, company_summary: str
    ) -> EligibilityVerdict:
        schema = json.dumps(EligibilityVerdict.model_json_schema())
        system_prompt = COMPARE_ELIGIBILITY_SYSTEM_PROMPT.format(schema=schema)
        user_message = (
            f"Extracted requirements:\n{extracted.model_dump_json(exclude={'raw_model_output'})}\n\n"
            f"Already-computed numeric checks:\n{numeric_checks}\n\n"
            f"Company profile:\n{company_summary}"
        )

        for _ in range(3):
            raw = await self._chat(system_prompt, user_message, json_mode=True, purpose="compare")
            try:
                return EligibilityVerdict.model_validate(clean_output(json.loads(raw), 600))
            except (json.JSONDecodeError, ValidationError):
                continue

        return EligibilityVerdict(
            eligible=None, justification="AI eligibility check failed to produce valid output."
        )


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
    turnover = (
        f"{profile.annual_turnover:,.0f} {profile.annual_turnover_currency or ''}".strip()
        if profile.annual_turnover
        else "not stated"
    )
    experience = (
        f"{profile.similar_experience_value:,.0f} {profile.similar_experience_currency or ''} "
        f"across {profile.similar_experience_contract_count or 'an unstated number of'} contracts".strip()
        if profile.similar_experience_value
        else "not stated"
    )
    return (
        f"Name: {profile.name}\n"
        f"Core CPV codes (bids as sole contractor): {', '.join(profile.cpv_codes) or 'none listed'}\n"
        f"Secondary CPV codes (subcontracting interest): "
        f"{', '.join(profile.secondary_cpv_codes) or 'none listed'}\n"
        f"Certifications: {', '.join(profile.certifications) or 'none listed'}\n"
        f"Reference value ceiling for sole-contractor work: "
        f"{profile.annual_capacity or 'not stated'}\n"
        f"Annual turnover: {turnover}\n"
        f"Documented similar-experience track record: {experience}"
    )
