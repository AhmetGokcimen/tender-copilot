"""Country-agnostic pre-filter and scoring layer.

Operates only on the fields defined in models.tender.Tender, so it works
identically regardless of which adapter produced the record. Results are
written into UserTenderState (score, score_reasons), never back onto
Tender itself.
"""

from models.company import CompanyProfile
from models.tender import Tender


def prefilter(tenders: list[Tender], profile: CompanyProfile) -> list[Tender]:
    """Drop tenders with no CPV overlap or a blacklisted keyword match."""
    raise NotImplementedError


def score(tender: Tender, profile: CompanyProfile) -> tuple[int, list[str]]:
    """0-100 score + reasons, from CPV match strength and estimated value /
    capacity ratio."""
    raise NotImplementedError
