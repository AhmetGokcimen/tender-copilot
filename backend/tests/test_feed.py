"""Frontend-contract feed: nested shape, filters, sort, company, evidence."""

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from models.company import CompanyProfile
from models.tender import SourceSystem, Tender
from models.user_tender_state import UserTenderState

TENDER_KEYS = {
    "source_system", "external_id", "country_code", "title", "cpv_codes",
    "estimated_value", "currency", "publication_date", "submission_deadline",
    "raw_description", "source_url", "authority", "county", "procedure_type",
    "clarification_deadline", "state", "renewal_pattern",
}
STATE_KEYS = {
    "score", "score_reasons", "ai_summary", "ai_title_simplified",
    "extracted_requirements", "eligible", "country_authorization_status",
    "matched_requirements", "unmet_requirements", "missing_documents",
    "eligibility_justification", "status",
}
COMPANY_KEYS = {
    "id", "name", "cui", "industry", "founded_year", "team_size",
    "cpv_codes", "secondary_cpv_codes", "annual_capacity", "certifications",
    "blacklist_keywords", "annual_turnover", "annual_turnover_currency",
    "similar_experience_value", "similar_experience_currency",
    "similar_experience_contract_count", "target_countries", "keywords",
}

EXTRACTION = {
    "minimum_annual_turnover": 1000000.0,
    "turnover_currency": "RON",
    "similar_experience_years": None,
    "similar_experience_minimum_value": None,
    "similar_experience_minimum_value_currency": None,
    "similar_experience_max_contracts": None,
    "required_certifications": ["ISO 9001:2015", "ISO 27001"],
    "guarantee_amount": 50000.0,
    "guarantee_currency": "RON",
    "other_requirements": ["Warranty 24 months"],
    "uncertain_points": ["Deadline extension unclear"],
    "extraction_confidence": "high",
    "raw_model_output": None,
}


@pytest.fixture()
def seed(api: TestClient):
    from db import engine

    with Session(engine) as session:
        session.add(
            CompanyProfile(
                name="SC Transilvania Soft SRL", cui="RO18402933",
                cpv_codes=["30200000"], annual_capacity=15000000.0,
                certifications=["ISO 9001:2015"], blacklist_keywords=[],
            )
        )
        session.add(
            Tender(
                source_system=SourceSystem.ROMANIA_SEAP, external_id="1001",
                country_code="RO", title="Laptops for schools",
                contracting_authority="Ministerul Educatiei", cpv_codes=["30200000"],
                estimated_value=4200000.0, currency="RON",
                publication_date=datetime(2026, 10, 18, tzinfo=UTC),
                submission_deadline=datetime(2026, 11, 20, tzinfo=UTC),
                source_url="https://e-licitatie.ro/1001",
                county="Cluj", procedure_type="open",
                clarification_deadline=datetime(2026, 11, 10, tzinfo=UTC),
                ai_title_simplified="School laptops",
                extracted_requirements=EXTRACTION, extraction_confidence="high",
            )
        )
        session.add(
            Tender(
                source_system=SourceSystem.ROMANIA_SEAP, external_id="1002",
                country_code="RO", title="City hall helpdesk",
                contracting_authority="Primaria Cluj", cpv_codes=["50300000"],
                estimated_value=860000.0, currency="RON",
                publication_date=datetime(2026, 10, 10, tzinfo=UTC),
                submission_deadline=datetime(2026, 10, 30, tzinfo=UTC),
                county="Brasov", procedure_type="restricted",
            )
        )
        session.add(
            Tender(
                source_system=SourceSystem.ROMANIA_SEAP, external_id="1003",
                country_code="RO", title="Catering framework",
                cpv_codes=["55500000"],
                publication_date=datetime(2026, 10, 24, tzinfo=UTC),
            )
        )
        session.commit()
        company = session.get(CompanyProfile, 1)
        assert company is not None
        from core.membership import get_or_create_user, link_user_company

        user = get_or_create_user(
            session, subject="u", email="u@x.ro", name="U", provider="demo"
        )
        link_user_company(session, user.id, company.id)
        session.add(
            UserTenderState(
                tender_source_system=SourceSystem.ROMANIA_SEAP,
                tender_external_id="1001", company_id=company.id, score=92,
                score_reasons=["CPV match"], ai_summary="Buy laptops.",
                eligible=True, matched_requirements=["ISO 9001:2015"],
                unmet_requirements=["ISO 27001"],
                eligibility_justification="Mostly eligible.", status="new",
            )
        )
        session.add(
            UserTenderState(
                tender_source_system=SourceSystem.ROMANIA_SEAP,
                tender_external_id="1002", company_id=company.id, score=55,
                score_reasons=["Partial overlap"], status="reviewing",
            )
        )
        session.commit()
    return api


def _auth() -> dict:
    from core.auth import create_access_token

    token = create_access_token(sub="u", email="u@x.ro", name="U", provider="demo")
    return {"Authorization": f"Bearer {token}"}


def test_feed_matches_frontend_shape_exactly(seed: TestClient) -> None:
    items = seed.get("/api/tenders", headers=_auth()).json()
    assert [t["external_id"] for t in items] == ["1001", "1002", "1003"]  # match sort
    for item in items:
        assert set(item) == TENDER_KEYS, set(item) ^ TENDER_KEYS
        assert set(item["state"]) == STATE_KEYS, set(item["state"]) ^ STATE_KEYS

    first, _, last = items
    assert first["authority"] == "Ministerul Educatiei"
    assert first["county"] == "Cluj"
    assert first["state"]["extracted_requirements"] == [
        "Annual turnover ≥ 1,000,000 RON",
        "ISO 9001:2015",
        "ISO 27001",
        "Bid guarantee 50,000 RON",
        "Warranty 24 months",
    ]
    assert first["state"]["missing_documents"] == ["ISO 27001"]
    assert first["state"]["ai_title_simplified"] == "School laptops"

    assert last["authority"] == ""
    assert last["county"] == ""
    assert last["procedure_type"] == "open"
    assert last["state"]["status"] == "new"
    assert last["state"]["score"] is None
    assert last["state"]["extracted_requirements"] == []


def test_feed_filters_and_sort(seed: TestClient) -> None:
    get = lambda q: [t["external_id"] for t in seed.get(f"/api/tenders{q}", headers=_auth()).json()]
    assert get("?county=Cluj") == ["1001"]
    assert get("?cpv_code=50300000") == ["1002"]
    assert get("?min_value=1000000") == ["1001"]
    assert get("?min_score=90") == ["1001"]
    assert get("?procedure_type=restricted") == ["1002"]
    assert get("?eligible=true") == ["1001"]
    assert get("?search=laptop") == ["1001"]
    assert get("?sort=deadline") == ["1002", "1001", "1003"]
    assert get("?sort=value") == ["1001", "1002", "1003"]
    assert get("?limit=1&offset=1") == ["1002"]
    assert get("?county=Nowhere") == []


def test_feed_detail_and_company_scope(seed: TestClient) -> None:
    item = seed.get("/api/tenders/1002", headers=_auth()).json()
    assert item["external_id"] == "1002"
    assert item["state"]["status"] == "reviewing"
    assert seed.get("/api/tenders/nope", headers=_auth()).status_code == 404

    from core.membership import link_user_company
    from db import engine
    from models.user import User

    with Session(engine) as session:
        session.add(CompanyProfile(name="Second Co"))
        session.commit()
        me = session.exec(select(User).where(User.subject == "u")).one()
        link_user_company(session, me.id, 2)
    scoped = seed.get("/api/tenders/1001?company_id=2", headers=_auth()).json()
    assert scoped["state"]["score"] is None  # second company never scored it


def test_company_and_evidence(seed: TestClient) -> None:
    company = seed.get("/api/company", headers=_auth()).json()
    assert set(company) == COMPANY_KEYS
    assert (company["name"], company["cui"]) == ("SC Transilvania Soft SRL", "RO18402933")
    evidence = seed.get("/api/company/evidence", headers=_auth()).json()
    assert evidence == [
        {"id": "cert-1", "name": "ISO 9001:2015", "type": "Certification",
         "valid_until": None}
    ]


def test_company_missing_returns_404(api: TestClient) -> None:
    assert api.get("/api/company", headers=_auth()).status_code == 404
    assert api.get("/api/tenders", headers=_auth()).json() == []


def test_status_patch_updates_state(seed: TestClient) -> None:
    res = seed.patch(
        "/api/tenders/1002/status", json={"status": "applied"}, headers=_auth()
    )
    assert res.status_code == 200
    assert res.json()["state"]["status"] == "applied"
    assert seed.get("/api/tenders/1002", headers=_auth()).json()["state"]["status"] == "applied"
    bad = seed.patch("/api/tenders/1002/status", json={"status": "bogus"}, headers=_auth())
    assert bad.status_code == 422
    missing = seed.patch("/api/tenders/1003/status", json={"status": "applied"}, headers=_auth())
    assert missing.status_code == 404  # no state row yet — score first, like the company PATCH


def test_feed_needs_auth(seed: TestClient) -> None:
    assert seed.get("/api/tenders").status_code == 401
