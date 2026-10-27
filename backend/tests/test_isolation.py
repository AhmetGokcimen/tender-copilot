"""Tenant isolation: user A can never read/write user B's companies."""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from models.company import CompanyProfile
from models.tender import SourceSystem, Tender
from models.user_tender_state import UserTenderState


@pytest.fixture()
def two_tenants(api: TestClient):
    from core.membership import get_or_create_user, link_user_company
    from db import engine

    with Session(engine) as session:
        session.add(CompanyProfile(name="Company A"))
        session.add(CompanyProfile(name="Company B"))
        session.add(
            Tender(
                source_system=SourceSystem.ROMANIA_SEAP, external_id="1001",
                country_code="RO", title="Shared tender",
            )
        )
        session.commit()
        user_a = get_or_create_user(
            session, subject="a", email="a@x.ro", name="A", provider="google"
        )
        user_b = get_or_create_user(
            session, subject="b", email="b@x.ro", name="B", provider="google"
        )
        link_user_company(session, user_a.id, 1)
        link_user_company(session, user_b.id, 2)
        session.add(
            UserTenderState(
                tender_source_system=SourceSystem.ROMANIA_SEAP,
                tender_external_id="1001", company_id=2, score=90, status="reviewing",
            )
        )
        session.commit()
    return api


def _auth(sub: str) -> dict:
    from core.auth import create_access_token

    token = create_access_token(
        sub=sub, email=f"{sub}@x.ro", name=sub.upper(), provider="google"
    )
    return {"Authorization": f"Bearer {token}"}


def test_company_listing_is_scoped(two_tenants: TestClient) -> None:
    mine = two_tenants.get("/api/companies", headers=_auth("a")).json()
    assert [c["name"] for c in mine["items"]] == ["Company A"]


def test_cross_company_reads_are_forbidden(two_tenants: TestClient) -> None:
    api = two_tenants
    assert api.get("/api/companies/2", headers=_auth("a")).status_code == 403
    assert api.get("/api/companies/999", headers=_auth("a")).status_code == 404
    assert api.get("/api/companies/2/tenders", headers=_auth("a")).status_code == 403
    assert api.get("/api/tenders?company_id=2", headers=_auth("a")).status_code == 403
    assert api.get("/api/tenders/1001?company_id=2", headers=_auth("a")).status_code == 403


def test_cross_company_writes_are_forbidden(two_tenants: TestClient) -> None:
    api = two_tenants
    full = api.get("/api/companies/1", headers=_auth("a")).json()
    assert (
        api.patch("/api/companies/2", json=full, headers=_auth("a")).status_code == 403
    )
    assert (
        api.post("/api/companies/2/score", headers=_auth("a")).status_code == 403
    )
    assert (
        api.post(
            "/api/companies/2/tenders/romania/1001/eligibility", headers=_auth("a")
        ).status_code
        == 403
    )
    assert (
        api.patch(
            "/api/companies/2/tenders/romania/1001", json={"status": "applied"},
            headers=_auth("a"),
        ).status_code
        == 403
    )


def test_states_never_leak_across_tenants(two_tenants: TestClient) -> None:
    api = two_tenants
    (item,) = api.get("/api/tenders", headers=_auth("a")).json()
    assert item["state"]["score"] is None  # B's score=90 stays invisible
    assert item["state"]["status"] == "new"
    res = api.patch(
        "/api/tenders/1001/status", json={"status": "applied"}, headers=_auth("a")
    )
    assert res.status_code == 404  # A never scored it; B's row untouched
    mine = api.get("/api/tenders/1001", headers=_auth("b")).json()
    assert (mine["state"]["score"], mine["state"]["status"]) == (90, "reviewing")


def test_company_singleton_is_user_scoped(two_tenants: TestClient) -> None:
    api = two_tenants
    assert api.get("/api/company", headers=_auth("a")).json()["name"] == "Company A"
    assert api.get("/api/company", headers=_auth("b")).json()["name"] == "Company B"
    assert api.get("/api/company", headers=_auth("fresh")).status_code == 404


def test_create_company_auto_links_owner(two_tenants: TestClient) -> None:
    api = two_tenants
    created = api.post(
        "/api/companies", json={"name": "Fresh Co"}, headers=_auth("fresh")
    ).json()
    me = api.get("/api/auth/me", headers=_auth("fresh")).json()
    assert me["company_ids"] == [created["id"]]
