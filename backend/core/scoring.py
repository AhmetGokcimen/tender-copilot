"""Country-agnostic pre-filter and scoring layer.

Operates only on the fields defined in models.tender.Tender and
models.company.CompanyProfile, so it works identically regardless of which
adapter produced the record. Results are written into UserTenderState
(score, score_reasons), never back onto Tender itself.

The approach (blacklist -> CPV-tier base score -> value-ratio bands ->
deadline penalty -> AI-call threshold) is carried over from a single-user,
single-country prototype that validated it against real SEAP data; the
constants below are that prototype's defaults, tunable per company later.

Deliberately NOT decided here: whether a tender is actually eligible. This
only ranks "worth asking the AI to look closer", same spirit as the old
Turkish `kural_notu` (always keep + explain, never silently drop).
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime

from backend.models.company import CompanyProfile
from backend.models.tender import Tender

CORE_CPV_BASE_SCORE = 75
SECONDARY_CPV_BASE_SCORE = 35

# (min_ratio, max_ratio, points) on estimated_value / annual_capacity.
# Reward only applies to a secondary-CPV match: a core match already starts
# high, so rewarding it too would erase the priority gap between the tiers.
VALUE_REWARD_BANDS = [(0.3, 2.0, 20), (2.0, 5.0, 5)]
VALUE_PENALTY_BANDS = [(5.0, 10.0, -15), (10.0, None, -35)]
TINY_VALUE_RATIO = 0.03
TINY_VALUE_PENALTY = -10

SHORT_DEADLINE_DAYS = 3
SHORT_DEADLINE_PENALTY = -20

AI_SCORE_THRESHOLD = 45


@dataclass
class ScoreResult:
    score: int
    reasons: list[str] = field(default_factory=list)
    ai_recommended: bool = False


def _band(ratio: float, bands: list[tuple[float, float | None, int]]) -> int:
    for lo, hi, points in bands:
        if ratio >= lo and (hi is None or ratio < hi):
            return points
    return 0


def _blacklist_hit(tender: Tender, profile: CompanyProfile) -> str | None:
    haystack = f"{tender.title} {tender.cpv_codes[0] if tender.cpv_codes else ''}".lower()
    for kw in profile.blacklist_keywords:
        if kw and kw.lower() in haystack:
            return kw
    return None


def evaluate(tender: Tender, profile: CompanyProfile) -> ScoreResult:
    """Score a single tender against a company profile. Never drops the
    tender — a low/zero score with reasons is the signal, same as the AI
    layer, matching "don't decide, justify"."""
    hit = _blacklist_hit(tender, profile)
    if hit:
        return ScoreResult(
            score=0,
            reasons=[f"Blacklisted keyword matched: '{hit}' — out of scope by company policy"],
        )

    main_cpv = tender.cpv_codes[0] if tender.cpv_codes else None
    lot_cpvs = set(tender.cpv_codes[1:])
    core_match = main_cpv in profile.cpv_codes
    secondary_match = (not core_match) and (
        main_cpv in profile.secondary_cpv_codes
        or bool(lot_cpvs & set(profile.cpv_codes))
        or bool(lot_cpvs & set(profile.secondary_cpv_codes))
    )

    if not core_match and not secondary_match:
        return ScoreResult(score=0, reasons=["No CPV overlap with company profile"])

    score = CORE_CPV_BASE_SCORE if core_match else SECONDARY_CPV_BASE_SCORE
    reasons = [
        "Main CPV matches a code the company bids as sole contractor on"
        if core_match
        else "Matched only via a secondary/lot CPV — subcontracting opportunity, not sole contractor"
    ]

    if profile.annual_capacity and tender.estimated_value:
        ratio = tender.estimated_value / profile.annual_capacity

        if secondary_match:
            bonus = _band(ratio, VALUE_REWARD_BANDS)
            if bonus:
                score += bonus
                reasons.append(f"Value is {ratio:.2f}x the reference ceiling — within comfortable range")

        penalty = _band(ratio, VALUE_PENALTY_BANDS)
        if penalty:
            score += penalty
            reasons.append(f"Value is {ratio:.1f}x the reference ceiling — unrealistic to lead")

        if ratio < TINY_VALUE_RATIO:
            score += TINY_VALUE_PENALTY
            reasons.append("Value is very small relative to capacity — may not cover mobilization cost")

    if tender.submission_deadline:
        days_left = (tender.submission_deadline - datetime.now(UTC)).days
        if days_left < 0:
            return ScoreResult(score=0, reasons=["Submission deadline has already passed"])
        if days_left < SHORT_DEADLINE_DAYS:
            score += SHORT_DEADLINE_PENALTY
            reasons.append(f"Only {days_left} day(s) left to submit — limited prep time")

    score = max(0, min(100, score))
    return ScoreResult(score=score, reasons=reasons, ai_recommended=score >= AI_SCORE_THRESHOLD)


def prefilter(tenders: list[Tender], profile: CompanyProfile) -> list[Tender]:
    """Of the given tenders, the subset worth spending an AI call on.
    Everything else should still be stored/shown — just not AI-enriched."""
    return [t for t in tenders if evaluate(t, profile).ai_recommended]
