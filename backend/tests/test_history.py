"""Authority history aggregation + renewal detection (detail only)."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.models.award import Award
from backend.models.tender import SourceSystem, Tender

AUTH = "123 - Primaria Cluj"


def _tender(external_id: str, pub: datetime | None, cpv: str = "45233120") -> Tender:
    return Tender(
        source_system=SourceSystem.ROMANIA_SEAP, external_id=external_id,
        country_code="RO", title=f"T {external_id}",
        contracting_authority=AUTH, cpv_codes=[cpv], estimated_value=1000.0,
        currency="RON", publication_date=pub,
    )


def _award(external_id: str, winner: str, value: float) -> Award:
    return Award(
        source_system=SourceSystem.ROMANIA_SEAP, external_id=external_id,
        country_code="RO", title=f"A {external_id}", contracting_authority=AUTH,
        cpv_codes=["45233120"], contract_value=value, currency="RON",
        award_date=datetime(2026, 9, 1, tzinfo=UTC),
        winner_name=winner, winner_cif="RO1",
    )


def _auth() -> dict:
    from backend.core.auth import create_access_token

    token = create_access_token(sub="u", email="u@x.ro", name="U", provider="demo")
    return {"Authorization": f"Bearer {token}"}


def _seed_periodic(session: Session) -> None:
    base = datetime(2026, 1, 5, tzinfo=UTC)
    for i in range(4):
        session.add(_tender(f"p{i}", base + timedelta(days=90 * i)))
    session.add(_tender("other-group", base, cpv="30200000"))  # same buyer, other division
    other = _tender("other-buyer", base)
    other.contracting_authority = "999 - Alt Buyer"
    session.add(other)
    session.add(_award("a1", "ACME SRL", 100.0))
    session.add(_award("a2", "ACME SRL", 200.0))
    session.add(_award("a3", "Beta SA", 300.0))
    session.commit()


def test_authority_history_aggregates_pair(api: TestClient) -> None:
    from backend.db import engine

    with Session(engine) as session:
        _seed_periodic(session)
    res = api.get("/api/tenders/p3/authority-history", headers=_auth())
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["authority"] == AUTH
    assert body["cpv_group"] == "45"
    assert body["notices"]["count"] == 4  # other division/buyer excluded
    assert body["notices"]["total_estimated_value"] == 4000.0
    assert body["awards"]["count"] == 3
    assert body["awards"]["total_value"] == 600.0
    assert [(w["name"], w["wins"]) for w in body["awards"]["winners"]] == [
        ("ACME SRL", 2), ("Beta SA", 1)]
    assert body["insufficient_data"] is False
    assert body["sample_size"] == 3


def test_authority_history_insufficient_data(api: TestClient) -> None:
    from backend.db import engine

    with Session(engine) as session:
        session.add(_tender("solo", datetime(2026, 5, 5, tzinfo=UTC)))
        session.add(_award("a1", "ACME SRL", 100.0))
        session.commit()
    body = api.get("/api/tenders/solo/authority-history", headers=_auth()).json()
    assert body["awards"]["count"] == 1
    assert body["insufficient_data"] is True
    assert body["sample_size"] == 1


def test_authority_history_404(api: TestClient) -> None:
    assert api.get("/api/tenders/nope/authority-history", headers=_auth()).status_code == 404
    assert api.get("/api/tenders/p0/authority-history").status_code == 401


def test_renewal_detected_on_detail(api: TestClient) -> None:
    from backend.db import engine

    with Session(engine) as session:
        _seed_periodic(session)
    item = api.get("/api/tenders/p3", headers=_auth()).json()
    pattern = item["renewal_pattern"]
    assert pattern["detected"] is True
    assert pattern["confidence"] == "high"  # 4 points, identical gaps
    assert pattern["prior_count"] == 3
    assert pattern["avg_interval_days"] == 90.0
    # Last point 2026-10-02 (base + 270d) + 90d mean gap.
    assert pattern["next_expected_date"].startswith("2026-12-31")
    assert "Estimate" in pattern["note"]


def test_renewal_sparse_returns_null(api: TestClient) -> None:
    from backend.db import engine

    with Session(engine) as session:
        session.add(_tender("solo", datetime(2026, 5, 5, tzinfo=UTC)))
        session.commit()
    item = api.get("/api/tenders/solo", headers=_auth()).json()
    assert item["renewal_pattern"] is None


def test_renewal_irregular_reports_no_pattern(api: TestClient) -> None:
    from backend.db import engine

    with Session(engine) as session:
        session.add(_tender("r0", datetime(2026, 1, 5, tzinfo=UTC)))
        session.add(_tender("r1", datetime(2026, 1, 20, tzinfo=UTC)))
        session.add(_tender("r2", datetime(2026, 9, 5, tzinfo=UTC)))
        session.commit()
    pattern = api.get("/api/tenders/r2", headers=_auth()).json()["renewal_pattern"]
    assert pattern["detected"] is False
    assert pattern["confidence"] is None
    assert pattern["next_expected_date"] is None
    assert pattern["prior_count"] == 2


def test_feed_leaves_renewal_null(api: TestClient) -> None:
    from backend.core.membership import get_or_create_user, link_user_company
    from backend.db import engine
    from backend.models.company import CompanyProfile

    with Session(engine) as session:
        _seed_periodic(session)
        session.add(CompanyProfile(name="Feed Co"))
        session.commit()
        user = get_or_create_user(
            session, subject="u", email="u@x.ro", name="U", provider="demo"
        )
        link_user_company(session, user.id, 1)
    items = api.get("/api/tenders", headers=_auth()).json()
    assert items, "feed unexpectedly empty"
    assert all(t["renewal_pattern"] is None for t in items)
