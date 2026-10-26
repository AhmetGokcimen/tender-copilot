"""Country-agnostic pre-filter and scoring layer.

Operates only on the fields defined in app.core.models.Tender, so it works
identically regardless of which adapter produced the record.
"""

from app.core.models import CompanyProfile, Tender, TenderScore


def prefilter(tenders: list[Tender], profile: CompanyProfile) -> list[Tender]:
    """Drop tenders with no CPV overlap or a blacklisted keyword match."""
    raise NotImplementedError


def score(tender: Tender, profile: CompanyProfile) -> TenderScore:
    """0-100 score from CPV match strength and estimated value / capacity ratio."""
    raise NotImplementedError
