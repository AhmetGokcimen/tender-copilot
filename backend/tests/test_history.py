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


def test_awards_won_matches_cui_exactly(api: TestClient) -> None:
    from backend.db import engine

    def won(eid: str, cif: str, day: int) -> Award:
        return Award(
            source_system=SourceSystem.ROMANIA_SEAP, external_id=eid, country_code="RO", title=f"W {eid}",
            contracting_authority=AUTH, cpv_codes=["45233120"], contract_value=10.0, currency="RON",
            award_date=datetime(2026, 9, day, tzinfo=UTC), winner_cif=cif,
        )

    with Session(engine) as session:
        session.add_all([won("w1", "RO 2816464", 1), won("w2", "2816464", 2), won("w3", "12816464", 3)])
        session.commit()
    assert api.get("/api/awards/won?cui=2816464").status_code == 401
    res = api.get("/api/awards/won?cui=RO2816464", headers=_auth())
    assert res.status_code == 200, res.text
    assert [r["title"] for r in res.json()] == ["W w2", "W w1"]  # newest first, 12816464 excluded
    assert api.get("/api/awards/won?cui=ab", headers=_auth()).status_code == 422


def _winner_setup(monkeypatch, limit: int = 10) -> None:
    from backend.core import winners
    from backend.core.config import settings
    from backend.db import engine

    monkeypatch.setattr(settings, "past_winners_monthly_limit", limit)
    monkeypatch.setattr(winners, "anaf_balance", lambda cui, year: {"turnover": 5e6, "net_profit": 1e5, "employees": 12} if year == datetime.now(UTC).year - 1 else None)
    with Session(engine) as session:
        for i in range(7):
            session.add(Award(
                source_system=SourceSystem.ROMANIA_SEAP, external_id=f"pw{i}", country_code="RO", title=f"PW {i}",
                contracting_authority=AUTH, cpv_codes=["45233120"], contract_value=100.0 + i, currency="RON",
                award_date=datetime(2026, 1, 1 + i, tzinfo=UTC), winner_name=f"Firma {i % 2}", winner_cif=f"RO 100{i % 2}0",
            ))
        for eid in ("pt1", "pt2"):
            session.add(_tender(eid, datetime(2026, 9, 1, tzinfo=UTC)))
        empty = _tender("pt-empty", datetime(2026, 9, 1, tzinfo=UTC))
        empty.contracting_authority = "Nobody - No awards"
        session.add(empty)
        session.commit()


def test_past_winners_returns_last_five_and_charges_once(api: TestClient, monkeypatch) -> None:
    _winner_setup(monkeypatch)
    assert api.post("/api/tenders/pt1/past-winners").status_code == 401
    res = api.post("/api/tenders/pt1/past-winners", headers=_auth())
    assert res.status_code == 200, res.text
    body = res.json()
    assert [i["title"] for i in body["items"]] == ["PW 6", "PW 5", "PW 4", "PW 3", "PW 2"]  # newest five
    assert body["items"][0]["figures"] == {"year": datetime.now(UTC).year - 1, "turnover": 5e6, "net_profit": 1e5, "employees": 12}
    assert body["charged"] is True and body["quota"] == {"used": 1, "limit": 10}
    again = api.post("/api/tenders/pt1/past-winners", headers=_auth()).json()
    assert again["charged"] is False and again["quota"]["used"] == 1  # same tender again is free
    api.post("/api/tenders/pt2/past-winners", headers=_auth())
    assert api.get("/api/usage/past-winners", headers=_auth()).json() == {"used": 2, "limit": 10}


def test_past_winners_stops_at_the_limit_and_skips_empty(api: TestClient, monkeypatch) -> None:
    _winner_setup(monkeypatch, limit=1)
    empty = api.post("/api/tenders/pt-empty/past-winners", headers=_auth()).json()
    assert empty["items"] == [] and empty["charged"] is False and empty["quota"]["used"] == 0
    assert api.post("/api/tenders/pt1/past-winners", headers=_auth()).status_code == 200
    assert api.post("/api/tenders/pt2/past-winners", headers=_auth()).status_code == 429
    assert api.post("/api/tenders/pt1/past-winners", headers=_auth()).status_code == 200  # already paid for
    assert api.post("/api/tenders/missing/past-winners", headers=_auth()).status_code == 404


def _priced(eid: str, initial: float, final: float, cpv: str = "45233120") -> Award:
    return Award(
        source_system=SourceSystem.ROMANIA_SEAP, external_id=eid, country_code="RO", title=f"P {eid}",
        contracting_authority=AUTH, cpv_codes=[cpv], estimated_initial_value=initial, contract_value=final,
        currency="RON", award_date=datetime(2026, 3, 1, tzinfo=UTC), winner_name="ACME SRL", winner_cif="RO1",
    )


def test_renewal_endpoint_adds_price_range_for_pro(api: TestClient, monkeypatch) -> None:
    from backend.core.config import settings
    from backend.db import engine

    with Session(engine) as session:
        _seed_periodic(session)
        session.add_all([
            _priced("pr1", 1000.0, 900.0),   # -10 %
            _priced("pr2", 2000.0, 1700.0),  # -15 %
            _priced("pr3", 500.0, 510.0),    # +2 %
            _priced("pr-other", 1000.0, 100.0, cpv="45310000"),  # other CPV class: excluded
        ])
        session.commit()
    assert api.get("/api/tenders/p3/renewal").status_code == 401
    body = api.get("/api/tenders/p3/renewal", headers=_auth()).json()
    assert body["renewal"]["detected"] is True and body["price_locked"] is False
    assert body["price_range"] == {"sample_size": 3, "low_pct": -15.0, "median_pct": -10.0, "high_pct": 2.0, "cpv_prefix": "4523"}
    monkeypatch.setattr(settings, "default_plan", "growth")
    growth = api.get("/api/tenders/p3/renewal", headers=_auth()).json()
    assert growth["renewal"]["detected"] is True and growth["price_range"] is None and growth["price_locked"] is True
    monkeypatch.setattr(settings, "default_plan", "start")
    assert api.get("/api/tenders/p3/renewal", headers=_auth()).status_code == 403
    assert api.get("/api/tenders/missing/renewal", headers=_auth()).status_code in (403, 404)


def test_price_range_needs_enough_comparable_awards(api: TestClient) -> None:
    from backend.db import engine

    with Session(engine) as session:
        _seed_periodic(session)
        session.add_all([_priced("pr1", 1000.0, 900.0), _priced("pr2", 2000.0, 1700.0)])
        session.commit()
    assert api.get("/api/tenders/p3/renewal", headers=_auth()).json()["price_range"] is None


def test_past_winners_includes_whole_history_summary(api: TestClient, monkeypatch) -> None:
    _winner_setup(monkeypatch)
    body = api.post("/api/tenders/pt1/past-winners", headers=_auth()).json()
    assert body["summary"]["count"] == 7
    assert body["summary"]["top"][0]["wins"] >= body["summary"]["top"][-1]["wins"]
