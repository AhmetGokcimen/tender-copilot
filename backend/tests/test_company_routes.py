"""Plural company routes: true partial PATCH + paginated enrich."""

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.core.membership import get_or_create_user, link_user_company
from backend.models.company import CompanyProfile
from backend.models.country_authorization import CountryAuthorization
from backend.models.tender import SourceSystem, Tender
from backend.models.user_tender_state import UserTenderState


def _auth() -> dict:
    from backend.core.auth import create_access_token

    token = create_access_token(sub="u", email="u@x.ro", name="U", provider="demo")
    return {"Authorization": f"Bearer {token}"}


def _seed_company(session: Session) -> int:
    session.add(CompanyProfile(
        name="Patch Co", industry="software", annual_turnover=5_000_000.0,
        cpv_codes=["48000000"],
    ))
    session.commit()
    user = get_or_create_user(
        session, subject="u", email="u@x.ro", name="U", provider="demo"
    )
    company = session.exec(select(CompanyProfile)).one()
    link_user_company(session, user.id, company.id)
    return company.id


def test_plural_patch_is_partial_and_returns_object(api: TestClient) -> None:
    """Regression: PATCH used to return {} and reset omitted fields to
    defaults. Now it returns the full object and touches only sent keys."""
    from backend.db import engine

    with Session(engine) as session:
        company_id = _seed_company(session)
    res = api.patch(f"/api/companies/{company_id}", json={"team_size": 50}, headers=_auth())
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["team_size"] == 50
    assert body["name"] == "Patch Co"  # response is the full object, not {}
    assert body["industry"] == "software"
    assert body["annual_turnover"] == 5_000_000.0
    assert body["cpv_codes"] == ["48000000"]
    with Session(engine) as session:
        kept = session.get(CompanyProfile, company_id)
        assert (kept.name, kept.industry, kept.team_size) == ("Patch Co", "software", 50)


def test_plural_patch_explicit_null_clears(api: TestClient) -> None:
    from backend.db import engine

    with Session(engine) as session:
        company_id = _seed_company(session)
    res = api.patch(
        f"/api/companies/{company_id}", json={"industry": None}, headers=_auth()
    )
    assert res.status_code == 200
    assert res.json()["industry"] is None
    assert res.json()["name"] == "Patch Co"


def test_plural_patch_blank_name_rejected(api: TestClient) -> None:
    from backend.db import engine

    with Session(engine) as session:
        company_id = _seed_company(session)
    assert api.patch(
        f"/api/companies/{company_id}", json={"name": "  "}, headers=_auth()
    ).status_code == 422


def test_plural_patch_preseeds_industry(api: TestClient) -> None:
    from backend.db import engine

    with Session(engine) as session:
        company_id = _seed_company(session)
    # Explicit [] clears CPVs (explicit values, even empty, always apply)...
    cleared = api.patch(
        f"/api/companies/{company_id}", json={"cpv_codes": []}, headers=_auth()
    )
    assert cleared.json()["cpv_codes"] == []
    # ...then an industry change preseeds the empty list.
    res = api.patch(
        f"/api/companies/{company_id}", json={"industry": "construction"}, headers=_auth()
    )
    assert res.status_code == 200
    assert "45000000" in res.json()["cpv_codes"]
    assert res.json()["name"] == "Patch Co"


def test_plural_patch_seeds_authorizations_and_returns_object(api: TestClient) -> None:
    """The old {} came from the seed-commit expiring attrs without a
    reload — this path must return the full object too."""
    from backend.db import engine

    with Session(engine) as session:
        company_id = _seed_company(session)
    res = api.patch(
        f"/api/companies/{company_id}", json={"target_countries": ["RO"]}, headers=_auth()
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Patch Co"
    assert res.json()["target_countries"] == ["RO"]
    with Session(engine) as session:
        rows = session.exec(select(CountryAuthorization)).all()
        assert [(r.country_code, r.status) for r in rows] == [("RO", "not_started")]


def _seed_scored(session: Session, company_id: int) -> None:
    for i, score in enumerate([90, 70, 10]):
        session.add(Tender(
            source_system=SourceSystem.ROMANIA_SEAP, external_id=f"e{i}",
            country_code="RO", title=f"Tender {i}",
        ))
        session.add(UserTenderState(
            tender_source_system=SourceSystem.ROMANIA_SEAP,
            tender_external_id=f"e{i}", company_id=company_id,
            score=score, score_reasons=["seeded"],
        ))
    session.commit()


def test_enrich_pagination(api: TestClient) -> None:
    """limit=0 makes no AI calls, so pagination is testable without mocks."""
    from backend.db import engine

    with Session(engine) as session:
        company_id = _seed_company(session)
        _seed_scored(session, company_id)
    base = f"/api/companies/{company_id}/enrich?limit=0"
    assert len(api.post(base, headers=_auth()).json()) == 3  # historical default: all
    page = api.post(f"{base}&response_limit=2", headers=_auth()).json()
    assert [s["score"] for s in page] == [90, 70]
    page = api.post(f"{base}&offset=1&response_limit=1", headers=_auth()).json()
    assert [s["score"] for s in page] == [70]

