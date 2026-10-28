"""Authority history + renewal detection over synced Tender/Award rows.

Both read the SAME sibling set — notices by one contracting authority in
one CPV division — so they share the query. Matching is by exact
authority string: SEAP repeats the same "CIF - Name" line per notice, so
exact match is stable; genuinely renamed authorities split history
(documented limitation, not a silent merge).

Neither function writes anything and neither touches UserTenderState.
"""

from datetime import UTC, datetime
from itertools import pairwise

from sqlmodel import Session, select

from core.sync import cpv_group
from models.award import Award
from models.tender import Tender

# Fewer awards than this and any "who usually wins" claim is noise.
MIN_AWARDS_FOR_PATTERN = 3


def _siblings(
    session: Session, authority: str, group: str | None, exclude_external_id: str | None = None
) -> list[Tender]:
    """Same-authority notices in the same CPV division (group None matches
    only group-less notices). Dated-first ordering; self excludable."""
    rows = session.exec(
        select(Tender).where(Tender.contracting_authority == authority)
    ).all()
    out = [t for t in rows if cpv_group(t.cpv_codes[0] if t.cpv_codes else None) == group]
    if exclude_external_id is not None:
        out = [t for t in out if t.external_id != exclude_external_id]
    return sorted(out, key=lambda t: (t.publication_date is None, t.publication_date))


def authority_history(session: Session, tender: Tender) -> dict:
    """(contracting_authority, cpv_group) aggregation for one tender's
    buyer: notice volume + award/winner breakdown. Awards below
    MIN_AWARDS_FOR_PATTERN report insufficient_data instead of naming a
    "usual winner" off noise."""
    authority = tender.contracting_authority
    group = cpv_group(tender.cpv_codes[0] if tender.cpv_codes else None)
    if not authority:
        return {
            "authority": None,
            "cpv_group": group,
            "notices": {"count": 0, "first_date": None, "last_date": None,
                        "total_estimated_value": None},
            "awards": {"count": 0, "total_value": None, "winners": []},
            "insufficient_data": True,
            "sample_size": 0,
        }

    notices = _siblings(session, authority, group)
    dates = [t.publication_date for t in notices if t.publication_date is not None]
    values = [t.estimated_value for t in notices if t.estimated_value is not None]

    award_rows = session.exec(
        select(Award).where(Award.contracting_authority == authority)
    ).all()
    awards = [
        a for a in award_rows
        if cpv_group(a.cpv_codes[0] if a.cpv_codes else None) == group
    ]
    award_values = [a.contract_value for a in awards if a.contract_value is not None]
    by_winner: dict[str, dict] = {}
    for award in awards:
        name = (award.winner_name or "").strip() or "(unparsed)"
        entry = by_winner.setdefault(name, {"name": name, "wins": 0, "total_value": 0.0})
        entry["wins"] += 1
        entry["total_value"] += award.contract_value or 0.0
    winners = sorted(by_winner.values(), key=lambda e: (-e["wins"], -e["total_value"]))[:5]

    return {
        "authority": authority,
        "cpv_group": group,
        "notices": {
            "count": len(notices),
            "first_date": min(dates) if dates else None,
            "last_date": max(dates) if dates else None,
            "total_estimated_value": sum(values) if values else None,
        },
        "awards": {
            "count": len(awards),
            "total_value": sum(award_values) if award_values else None,
            "winners": winners,
        },
        "insufficient_data": len(awards) < MIN_AWARDS_FOR_PATTERN,
        "sample_size": len(awards),
    }


def renewal_pattern(session: Session, tender: Tender) -> dict | None:
    """Recurrence heuristic for one tender: same buyer + same CPV
    division + roughly periodic gaps => a renewal guess. Needs >= 3
    dated points (self + 2 priors minimum) for even a low-confidence
    read; fewer points return None (no basis, not "no pattern").

    Gaps are regular when max/min <= 1.8. next_expected_date is last +
    mean gap — an explicitly labeled ESTIMATE (see `note`), never a
    promise; irregular series return detected=False with the basis shown.
    """
    authority = tender.contracting_authority
    group = cpv_group(tender.cpv_codes[0] if tender.cpv_codes else None)
    if not authority:
        return None
    siblings = _siblings(session, authority, group)
    points = sorted(
        t.publication_date for t in siblings if t.publication_date is not None
    )
    prior_count = sum(
        1 for t in siblings
        if t.external_id != tender.external_id and t.publication_date is not None
    )
    basis_note = (
        f"Estimate from {prior_count} prior notice(s) by this authority in "
        f"CPV division {group or '?'}: a rough recurrence guess, not a prediction."
    )
    if len(points) < 3:
        return None
    gaps = [(b - a).days for a, b in pairwise(points)]
    positive = [g for g in gaps if g > 0]
    regular = (
        len(positive) == len(gaps)
        and len(gaps) > 0
        and max(positive) / min(positive) <= 1.8
    )
    mean_gap = sum(gaps) / len(gaps) if gaps else 0
    confidence = None
    if regular:
        confidence = "high" if len(points) >= 4 and max(positive) / min(positive) <= 1.4 else "medium"
        if len(points) == 3:
            confidence = "low"
    last = max(points)
    if last.tzinfo is None:  # SQLite reads back naive; treat as UTC
        last = last.replace(tzinfo=UTC)
    expected = (
        datetime.fromtimestamp(last.timestamp() + mean_gap * 86400, tz=UTC)
        if regular
        else None
    )
    return {
        "detected": regular,
        "confidence": confidence,
        "prior_count": prior_count,
        "avg_interval_days": round(mean_gap, 1),
        "next_expected_date": expected,
        "note": basis_note,
    }
