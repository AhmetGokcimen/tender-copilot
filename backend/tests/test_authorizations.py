"""CountryAuthorization model helpers + country requirements reference."""

import pytest
from sqlmodel import Session, select

from backend.models.company import CompanyProfile
from backend.models.country_authorization import CountryAuthorization


@pytest.fixture()
def session(api):
    from backend.db import engine

    with Session(engine) as session:
        yield session


def _company(session: Session) -> int:
    session.add(CompanyProfile(name="Co"))
    session.commit()
    return session.exec(select(CompanyProfile)).one().id


def test_upsert_creates_then_updates(session: Session) -> None:
    from backend.core.authorizations import upsert_authorization

    company_id = _company(session)
    first = upsert_authorization(session, company_id, "ro", "in_progress", "Filed ONRC forms")
    assert (first.country_code, first.status) == ("RO", "in_progress")
    assert first.requirement_notes == "Filed ONRC forms"
    assert first.updated_at is not None

    second = upsert_authorization(session, company_id, "RO", "obtained")
    assert second.id == first.id  # same (company, country) row
    assert second.status == "obtained"
    assert second.requirement_notes == "Filed ONRC forms"  # untouched fields survive


def test_upsert_validates_status_and_code(session: Session) -> None:
    from backend.core.authorizations import upsert_authorization

    company_id = _company(session)
    with pytest.raises(ValueError, match="status"):
        upsert_authorization(session, company_id, "RO", "maybe")
    with pytest.raises(ValueError, match="country_code"):
        upsert_authorization(session, company_id, "Romania", "obtained")
    rows = session.exec(select(CountryAuthorization)).all()
    assert rows == []


def test_ensure_rows_only_adds_missing(session: Session) -> None:
    from backend.core.authorizations import (
        ensure_authorization_rows,
        upsert_authorization,
    )

    company_id = _company(session)
    upsert_authorization(session, company_id, "RO", "obtained")
    ensure_authorization_rows(session, company_id, ["RO", "BG"])
    rows = {
        r.country_code: r.status
        for r in session.exec(select(CountryAuthorization)).all()
    }
    assert rows == {"RO": "obtained", "BG": "not_started"}


def test_status_map_empty_without_company(session: Session) -> None:
    from backend.core.authorizations import authorization_status_map

    assert authorization_status_map(session, None) == {}


def test_romania_guide_is_informational_not_advice() -> None:
    from backend.core.country_requirements import get_country_requirements

    ro = get_country_requirements("RO")
    assert ro["guide_available"] is True
    assert "ONRC" in ro["guidance"]
    assert "not legal advice" in ro["guidance"].lower()


def _auth(sub: str) -> dict:
    from backend.core.auth import create_access_token

    token = create_access_token(
        sub=sub, email=f"{sub}@x.ro", name=sub.upper(), provider="google"
    )
    return {"Authorization": f"Bearer {token}"}


def _owned_company(api, sub: str, name: str = "Co") -> int:
    return api.post("/api/company", json={"name": name}, headers=_auth(sub)).json()["id"]


def test_list_and_upsert_authorizations(api) -> None:
    _owned_company(api, "u")
    assert api.get("/api/company/authorizations", headers=_auth("u")).json() == []

    created = api.patch(
        "/api/company/authorizations/ro",
        json={"status": "in_progress", "requirement_notes": "Filed ONRC forms"},
        headers=_auth("u"),
    )
    assert created.status_code == 200
    assert created.json()["country_code"] == "RO"
    assert created.json()["status"] == "in_progress"

    updated = api.patch(
        "/api/company/authorizations/RO",
        json={"status": "obtained"},
        headers=_auth("u"),
    ).json()
    assert updated["status"] == "obtained"
    assert updated["requirement_notes"] == "Filed ONRC forms"

    listed = api.get("/api/company/authorizations", headers=_auth("u")).json()
    assert [(a["country_code"], a["status"]) for a in listed] == [("RO", "obtained")]


def test_authorization_endpoints_validate(api) -> None:
    _owned_company(api, "u")
    bad_status = api.patch(
        "/api/company/authorizations/RO", json={"status": "maybe"}, headers=_auth("u")
    )
    assert bad_status.status_code == 422
    bad_code = api.patch(
        "/api/company/authorizations/ROM", json={"status": "obtained"}, headers=_auth("u")
    )
    assert bad_code.status_code == 422
    assert api.get("/api/company/authorizations", headers=_auth("u")).json() == []


def test_authorizations_are_tenant_isolated(api) -> None:
    company_a = _owned_company(api, "a", "Company A")
    _owned_company(api, "b", "Company B")
    api.patch(
        "/api/company/authorizations/RO",
        json={"status": "obtained"},
        headers=_auth("a"),
    )

    assert (
        api.get(
            f"/api/company/authorizations?company_id={company_a}", headers=_auth("b")
        ).status_code
        == 403
    )
    assert (
        api.patch(
            f"/api/company/authorizations/RO?company_id={company_a}",
            json={"status": "not_started"},
            headers=_auth("b"),
        ).status_code
        == 403
    )
    # B's own list is untouched, A's row survived the attempt.
    assert api.get("/api/company/authorizations", headers=_auth("b")).json() == []
    kept = api.get("/api/company/authorizations", headers=_auth("a")).json()
    assert kept[0]["status"] == "obtained"


def test_target_countries_seed_not_started_rows(api) -> None:
    _owned_company(api, "u")
    api.patch("/api/company", json={"target_countries": ["RO"]}, headers=_auth("u"))
    seeded = api.get("/api/company/authorizations", headers=_auth("u")).json()
    assert [(a["country_code"], a["status"]) for a in seeded] == [("RO", "not_started")]

    api.patch(
        "/api/company/authorizations/RO", json={"status": "obtained"}, headers=_auth("u")
    )
    api.patch("/api/company", json={"target_countries": ["RO"]}, headers=_auth("u"))
    kept = api.get("/api/company/authorizations", headers=_auth("u")).json()
    assert kept[0]["status"] == "obtained"  # re-picking never resets progress


def _seed_multicountry_feed(api) -> None:
    from sqlmodel import Session

    from backend.core.membership import get_or_create_user, link_user_company
    from backend.db import engine
    from backend.models.tender import SourceSystem, Tender
    from backend.models.user_tender_state import UserTenderState

    with Session(engine) as session:
        session.add(CompanyProfile(name="Co"))
        for external_id, country in [("RO-1", "RO"), ("BG-1", "BG"), ("PL-1", "PL")]:
            session.add(
                Tender(
                    source_system=SourceSystem.ROMANIA_SEAP,
                    external_id=external_id,
                    country_code=country,
                    title=f"Tender {external_id}",
                )
            )
        session.commit()
        user = get_or_create_user(
            session, subject="u", email="u@x.ro", name="U", provider="google"
        )
        link_user_company(session, user.id, 1)
        session.add(
            UserTenderState(
                tender_source_system=SourceSystem.ROMANIA_SEAP,
                tender_external_id="RO-1",
                company_id=1,
                eligible=True,
            )
        )
        session.add(
            UserTenderState(
                tender_source_system=SourceSystem.ROMANIA_SEAP,
                tender_external_id="BG-1",
                company_id=1,
                eligible=False,
            )
        )
        session.commit()
    api.patch(
        "/api/company/authorizations/RO", json={"status": "not_started"},
        headers=_auth("u"),
    )
    api.patch(
        "/api/company/authorizations/BG", json={"status": "obtained"},
        headers=_auth("u"),
    )


def test_feed_reports_authorization_without_filtering(api) -> None:
    _seed_multicountry_feed(api)
    items = api.get("/api/tenders", headers=_auth("u")).json()
    by_id = {t["external_id"]: t["state"]["country_authorization_status"] for t in items}
    assert by_id == {"RO-1": "not_started", "BG-1": "obtained", "PL-1": None}


def test_eligible_and_authorization_stay_independent(api) -> None:
    _seed_multicountry_feed(api)
    items = api.get("/api/tenders", headers=_auth("u")).json()
    by_id = {
        t["external_id"]: (t["state"]["eligible"], t["state"]["country_authorization_status"])
        for t in items
    }
    # eligible tender, unauthorized country — and the exact reverse.
    assert by_id["RO-1"] == (True, "not_started")
    assert by_id["BG-1"] == (False, "obtained")
    # The eligible filter keeps working on its own dimension.
    filtered = api.get("/api/tenders?eligible=true", headers=_auth("u")).json()
    assert [t["external_id"] for t in filtered] == ["RO-1"]


def test_authorization_status_filter_is_opt_in(api) -> None:
    _seed_multicountry_feed(api)
    assert len(api.get("/api/tenders", headers=_auth("u")).json()) == 3
    filtered = api.get(
        "/api/tenders?authorization_status=obtained", headers=_auth("u")
    ).json()
    assert [t["external_id"] for t in filtered] == ["BG-1"]


def test_country_requirements_endpoint(api) -> None:
    ro = api.get("/api/countries/RO/requirements", headers=_auth("u")).json()
    assert ro["guide_available"] is True
    assert ro["name"] == "Romania"

    pl = api.get("/api/countries/pl/requirements", headers=_auth("u")).json()
    assert pl["guide_available"] is False
    assert pl["name"] == "Poland"

    assert api.get("/api/countries/ROM/requirements", headers=_auth("u")).status_code == 422
    assert api.get("/api/countries/RO/requirements").status_code == 401


def test_planned_countries_return_placeholders() -> None:
    from backend.core.country_requirements import get_country_requirements

    pl = get_country_requirements("pl")  # case-insensitive
    assert (pl["country_code"], pl["name"]) == ("PL", "Poland")
    assert pl["guide_available"] is False
    assert "coming soon" in pl["guidance"].lower()

    xx = get_country_requirements("XX")
    assert xx["guide_available"] is False
    assert xx["name"] is None
