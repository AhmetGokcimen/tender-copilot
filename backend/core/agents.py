"""The five bid-preparation agents, each a focused model call with its own
role, input and structured output. They run in order from the document
preparation screen and feed one another:

  spec        reads the notice + specification into numbered requirements
              (kept on the tender: every company shares one reading)
  eligibility checks the company against each qualification requirement
  legal       declarations, exclusion-ground notes, contract-clause concerns
  writer      the technical proposal text and the price-item list
  risk        what could sink the bid and what is missing before submission

Documents are written in Romanian (the language bids are submitted in);
the internal reviews follow the UI language. Every prompt forbids inventing
facts about the company or the tender: what the text does not say goes to an
explicit "not stated"/"to confirm" list.
"""

import json
from typing import Literal

from pydantic import BaseModel, ValidationError
from sqlmodel import Session

from backend.adapters.romania_seap.adapter import RomaniaSeapAdapter
from backend.ai.client import MetaAIClient, build_company_summary, build_tender_summary
from backend.ai.safety import clean_output
from backend.core.brief import gather_source
from backend.core.translate import enabled
from backend.models.company import CompanyProfile
from backend.models.tender import Tender

AGENTS = ("spec", "eligibility", "legal", "writer", "risk")


class SpecItem(BaseModel):
    ref: str  # R1, R2 ...
    text: str
    category: Literal["technical", "qualification", "financial", "contract", "documents"] = "technical"
    source: str = ""  # section / document it comes from, when the text says


class SpecAnalysis(BaseModel):
    items: list[SpecItem] = []
    deliverables: list[str] = []  # what is supplied/built, with quantities when stated
    award_criteria: str = ""
    duration: str = ""
    lots: str = ""
    documents_required: list[str] = []  # forms/documents the bidder must submit


class EligRow(BaseModel):
    ref: str
    requirement: str
    status: Literal["met", "not_met", "unclear"] = "unclear"
    basis: str = ""  # what in the company data supports the verdict
    action: str = ""  # what the company should do about it


class EligibilityReview(BaseModel):
    rows: list[EligRow] = []
    summary: str = ""


class Clause(BaseModel):
    clause: str
    concern: str


class LegalReview(BaseModel):
    declarations: list[str] = []  # declarations to include in the offer (Romanian)
    exclusion_notes: list[str] = []  # what the company must confirm for DUAE Part III
    clauses: list[Clause] = []  # contract clauses worth negotiating or pricing in
    flags: list[str] = []


class MethodStep(BaseModel):
    title: str
    text: str


class Phase(BaseModel):
    phase: str
    activities: str
    duration: str = ""


class ComplianceRow(BaseModel):
    ref: str
    requirement: str
    response: str


class PriceItem(BaseModel):
    description: str
    unit: str = "buc"
    quantity: str = ""


class TechnicalDraft(BaseModel):
    understanding: str = ""
    methodology: list[MethodStep] = []
    work_plan: list[Phase] = []
    resources: str = ""
    quality_hse: str = ""
    compliance: list[ComplianceRow] = []
    price_items: list[PriceItem] = []


class Risk(BaseModel):
    risk: str
    likelihood: Literal["low", "medium", "high"] = "medium"
    impact: Literal["low", "medium", "high"] = "medium"
    mitigation: str = ""


class RiskReview(BaseModel):
    risks: list[Risk] = []
    missing_before_submission: list[str] = []
    verdict: str = ""


MODELS: dict[str, type[BaseModel]] = {
    "spec": SpecAnalysis,
    "eligibility": EligibilityReview,
    "legal": LegalReview,
    "writer": TechnicalDraft,
    "risk": RiskReview,
}

COMMON_RULES = """\
Rules that apply to everything you write:
- Use ONLY facts given in the input. Never invent a quantity, date, price, \
name, certificate, staff number, reference project or capability. If the \
input does not say, leave the field empty (an empty string) or write \
"[de completat de operator]"; never write English phrases such as \
"not stated" or "to confirm" inside Romanian text.
- Keep project codes, street, village and institution names verbatim.
- Short, concrete sentences. No filler, no marketing language.
- Respond with ONLY a JSON object matching this schema, no other text:

{schema}"""

PROMPTS = {
    "spec": """\
You are the Spec Analyst on a public-procurement bid team. From the notice and \
specification text, list what the bidder must satisfy and deliver, as \
numbered items (R1, R2, ...), each tagged technical, qualification, \
financial, contract or documents, with the section it comes from when the \
text names one. Merge duplicates. Also fill deliverables (with quantities and \
capacities exactly as stated), award criteria, duration, lots and the list of \
forms/documents the bidder must submit. Write in Romanian, close to the \
source wording.

""",
    "eligibility": """\
You are the Eligibility Checker. For each requirement of category \
"qualification" or "documents" in the specification analysis, compare it with \
the company profile and its attached evidence and decide: met, not_met, or \
unclear (when the data cannot settle it). `basis` says exactly which company \
fact supports the verdict; `action` says what to do (obtain a certificate, \
add a reference, confirm a figure). Never mark met without a supporting \
fact. Turnover and experience figures are compared as the numbers given; \
do not recompute currencies. Write in {language}.

""",
    "legal": """\
You are the Legal Reviewer. Using Romanian public-procurement law (Law \
98/2016, HG 395/2016) and the specification analysis, produce: the \
declarations the offer should carry (in Romanian, ready to paste, no invented \
facts about the company), the points the company itself must confirm for the \
DUAE exclusion grounds (you cannot assert them on its behalf), contract \
clauses that deserve negotiation or pricing-in (penalties, guarantees, \
payment terms, change conditions) when the text states them, and any red \
flags. Write notes in {language}, declarations in Romanian.

""",
    "writer": """\
You are the Draft Writer. Write the technical proposal for the tender in \
Romanian, as a professional contractor would submit it: your understanding of \
the requirement, a methodology as titled steps that answer the technical \
requirements, a work plan by phases (durations only if the text gives \
a total duration to split; otherwise leave duration empty), resources and \
quality/HSE sections built ONLY from the company's declared certifications, \
capacity and profile, and a compliance table answering every technical \
requirement by ref. Also list the price items (description, unit, quantity as \
stated) that the financial offer must price, from the stated deliverables. \
Never claim equipment, staff, subcontractors or references that are not in \
the company data; where such detail is needed write "[de completat de operator]".

""",
    "risk": """\
You are the Risk Assessor. Using everything produced so far, list the real \
risks to winning and to executing this tender (each with likelihood, impact \
and a mitigation), the items missing before submission (documents, \
confirmations, figures the company must supply), and a one-paragraph verdict \
on whether the file is ready to submit. Do not make the go/no-go decision; \
the company does. Write in {language}.

""",
}


def _clip(value: object, limit: int) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return text[:limit]


async def _run(ai: MetaAIClient, agent: str, system_extra: dict, user_message: str) -> BaseModel | None:
    model = MODELS[agent]
    schema = json.dumps(model.model_json_schema())
    system = (PROMPTS[agent].format(**system_extra) + COMMON_RULES).replace("{schema}", schema)
    for _ in range(2):
        raw = await ai._chat(system, user_message, json_mode=True, purpose=f"agent:{agent}")  # noqa: SLF001
        try:
            return model.model_validate(clean_output(json.loads(raw), 700))
        except (json.JSONDecodeError, ValidationError):
            continue
    return None


def _tender_block(tender: Tender) -> str:
    parts = [build_tender_summary(tender)]
    if tender.raw_description:
        parts.append(f"Description: {_clip(tender.raw_description, 2000)}")
    if tender.brief:
        brief = tender.brief.get("ro") or tender.brief.get("en") or {}
        parts.append("Brief:\n" + _clip(brief, 4000))
    return "\n".join(parts)


async def run_agent(
    session: Session,
    agent: str,
    tender: Tender,
    company: CompanyProfile | None,
    *,
    evidence: list[str],
    context: dict,
    language: str,
    ai: MetaAIClient | None = None,
    adapter: RomaniaSeapAdapter | None = None,
) -> dict | None:
    """Run one agent and return its output (or None on failure / no AI key)."""
    if agent not in AGENTS or not enabled():
        return None
    ai = ai or MetaAIClient()

    if agent == "spec":
        if tender.spec:
            return tender.spec
        adapter = adapter or RomaniaSeapAdapter()
        source, from_docs, flags = await gather_source(adapter, tender, ai)
        analysis = await _run(ai, "spec", {}, source)
        if analysis is None:
            return None
        result = analysis.model_dump()
        result["source"] = "documents" if from_docs else "notice"
        result["flags"] = flags
        tender.spec = result
        session.add(tender)
        session.commit()
        return result

    spec = tender.spec or {}
    lang = "Romanian" if language == "ro" else "English"
    spec_text = _clip(spec, 9000) if spec else "(no specification analysis available)"
    company_text = build_company_summary(company) if company else "(no company profile)"
    evidence_text = "\n".join(f"- {e}" for e in evidence) or "(none attached)"

    if agent == "eligibility":
        user = f"Specification analysis:\n{spec_text}\n\nCompany profile:\n{company_text}\n\nAttached evidence documents:\n{evidence_text}"
    elif agent == "legal":
        user = f"Tender:\n{_tender_block(tender)}\n\nSpecification analysis:\n{spec_text}\n\nCompany profile:\n{company_text}"
    elif agent == "writer":
        user = (
            f"Tender:\n{_tender_block(tender)}\n\nSpecification analysis:\n{spec_text}\n\n"
            f"Company profile:\n{company_text}\n\nAttached evidence documents:\n{evidence_text}\n\n"
            f"Eligibility findings:\n{_clip(context.get('eligibility', ''), 3000)}"
        )
    else:  # risk
        user = (
            f"Tender:\n{_tender_block(tender)}\n\nSpecification analysis:\n{spec_text}\n\n"
            f"Company profile:\n{company_text}\n\nEligibility:\n{_clip(context.get('eligibility', ''), 3000)}\n\n"
            f"Legal review:\n{_clip(context.get('legal', ''), 3000)}\n\n"
            f"Technical draft:\n{_clip(context.get('writer', ''), 4000)}"
        )
    out = await _run(ai, agent, {"language": lang}, user)
    if out is None:
        return None
    data = out.model_dump()
    if agent == "eligibility":
        # "Met" has to rest on a stated fact about the company; otherwise it stays open.
        for row in data["rows"]:
            if row["status"] == "met" and len(row["basis"].strip()) < 8:
                row["status"] = "unclear"
                row["action"] = row["action"] or "No supporting company fact was given; check this yourself."
    return data

