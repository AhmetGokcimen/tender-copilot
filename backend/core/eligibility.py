"""Deterministic numeric pre-checks for the eligibility-comparison engine.

Turnover and similar-experience-value comparisons are plain arithmetic —
doing them in Python instead of asking the model to compare numbers removes
an easy source of error. The AI layer (ai.client.compare_eligibility) takes
these results as given facts and only has to reason about the parts that
genuinely need judgment: matching free-text certification requirements
against the company's own list, and writing the final justification.

Each check returns True/False/None — None means "the tender states no such
requirement" or "the company hasn't recorded the data needed to check it",
which are both "can't fail the company on this", not an automatic pass.
"""

from dataclasses import dataclass

from backend.ai.client import ExtractedRequirements
from backend.models.company import CompanyProfile


@dataclass
class NumericChecks:
    turnover_ok: bool | None
    turnover_note: str
    experience_value_ok: bool | None
    experience_value_note: str

    def as_text(self) -> str:
        return f"- Turnover: {self.turnover_note}\n- Similar-experience value: {self.experience_value_note}"


def _compare(
    required: float | None,
    required_currency: str | None,
    actual: float | None,
    actual_currency: str | None,
    label: str,
) -> tuple[bool | None, str]:
    if required is None:
        return None, f"No {label} requirement stated in the tender."
    if actual is None:
        return None, f"Tender requires {required:,.0f} {required_currency or ''} — company has no {label} on file."
    if required_currency and actual_currency and required_currency != actual_currency:
        note = (
            f"Tender requires {required:,.0f} {required_currency}, company has {actual:,.0f} {actual_currency}"
            " — different currencies, can't compare without a conversion rate."
        )
        return None, note
    ok = actual >= required
    verdict = "met" if ok else "NOT met"
    return ok, f"Tender requires {required:,.0f}, company has {actual:,.0f} — {verdict}."


def run_numeric_checks(extracted: ExtractedRequirements, profile: CompanyProfile) -> NumericChecks:
    turnover_ok, turnover_note = _compare(
        extracted.minimum_annual_turnover,
        extracted.turnover_currency,
        profile.annual_turnover,
        profile.annual_turnover_currency,
        "annual turnover",
    )
    experience_ok, experience_note = _compare(
        extracted.similar_experience_minimum_value,
        extracted.similar_experience_minimum_value_currency,
        profile.similar_experience_value,
        profile.similar_experience_currency,
        "similar-experience value",
    )
    return NumericChecks(turnover_ok, turnover_note, experience_ok, experience_note)
