"""Onboarding wizard backend: create, stepwise patch, status, options."""

from fastapi.testclient import TestClient

DETAIL_KEYS = {
    "id", "name", "cui", "industry", "founded_year", "team_size",
    "cpv_codes", "secondary_cpv_codes", "annual_capacity", "certifications",
    "blacklist_keywords", "annual_turnover", "annual_turnover_currency",
    "similar_experience_value", "similar_experience_currency",
    "similar_experience_contract_count", "target_countries", "keywords",
}


def _auth(sub: str = "wiz") -> dict:
    from core.auth import create_access_token

    token = create_access_token(
        sub=sub, email=f"{sub}@x.ro", name=sub.upper(), provider="google"
    )
    return {"Authorization": f"Bearer {token}"}


def test_create_company_minimal_and_link(api: TestClient) -> None:
    created = api.post("/api/company", json={"name": "Wizard Co"}, headers=_auth()).json()
    assert set(created) == DETAIL_KEYS
    assert created["name"] == "Wizard Co"
    assert created["cui"] == ""
    me = api.get("/api/auth/me", headers=_auth()).json()
    assert me["company_ids"] == [created["id"]]


def test_create_company_validates_and_preseeds(api: TestClient) -> None:
    bad = api.post("/api/company", json={"name": "X", "industry": "alchemy"}, headers=_auth())
    assert bad.status_code == 422
    blank = api.post("/api/company", json={"name": "  "}, headers=_auth())
    assert blank.status_code == 422
    seeded = api.post(
        "/api/company", json={"name": "Soft Co", "industry": "software"}, headers=_auth()
    ).json()
    assert seeded["cpv_codes"] == ["48000000", "72200000"]


def test_patch_company_stepwise(api: TestClient) -> None:
    created = api.post("/api/company", json={"name": "Step Co"}, headers=_auth()).json()
    step1 = api.patch(
        "/api/company", json={"industry": "consulting", "founded_year": 2015},
        headers=_auth(),
    ).json()
    assert (step1["industry"], step1["founded_year"]) == ("consulting", 2015)
    assert step1["name"] == "Step Co"  # untouched fields survive
    bad = api.patch(
        "/api/company", json={"keywords": ["teleportation"]}, headers=_auth()
    )
    assert bad.status_code == 422
    assert created["id"] == step1["id"]


def test_patch_company_needs_a_company(api: TestClient) -> None:
    res = api.patch("/api/company", json={"industry": "software"}, headers=_auth("nobody"))
    assert res.status_code == 404


def test_onboarding_status_tracks_wizard(api: TestClient) -> None:
    empty = api.get("/api/company/onboarding-status", headers=_auth()).json()
    assert empty["company_id"] is None
    assert empty["complete"] is False
    assert empty["missing_required"] == ["name", "industry", "annual_turnover"]

    api.post("/api/company", json={"name": "Step Co"}, headers=_auth())
    partial = api.get("/api/company/onboarding-status", headers=_auth()).json()
    assert partial["complete"] is False
    assert partial["missing_required"] == ["industry", "annual_turnover"]
    assert "keywords" in partial["missing_optional"]

    api.patch(
        "/api/company",
        json={"industry": "software", "annual_turnover": 500000.0},
        headers=_auth(),
    )
    done = api.get("/api/company/onboarding-status", headers=_auth()).json()
    assert done["complete"] is True
    assert done["missing_required"] == []


def test_company_options_come_from_backend(api: TestClient) -> None:
    options = api.get("/api/company/options", headers=_auth()).json()
    industries = {i["key"]: i for i in options["industries"]}
    assert industries["software"]["suggested_cpv_codes"] == ["48000000", "72200000"]
    keywords = {k["key"]: k for k in options["keywords"]}
    assert keywords["software-licenses"]["related_cpv_codes"] == ["48000000"]
    assert options["countries"] == [
        {"code": "RO", "name": "Romania", "source_systems": ["romania_seap"]}
    ]


def test_company_detail_superset_and_scoping(api: TestClient) -> None:
    mine = api.post("/api/company", json={"name": "Mine"}, headers=_auth("a")).json()
    api.post("/api/company", json={"name": "Theirs"}, headers=_auth("b"))
    detail = api.get("/api/company", headers=_auth("a")).json()
    assert set(detail) == DETAIL_KEYS
    assert detail["name"] == "Mine"
    assert api.get("/api/company", headers=_auth("b")).json()["name"] == "Theirs"
    assert api.patch("/api/company?company_id=2", json={"name": "Hijack"}, headers=_auth("a")).status_code == 403
    assert mine["id"] == 1
