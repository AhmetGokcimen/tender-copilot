"""Public map feed: no auth, newest construction notice per county, last 24h only."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.db import engine
from backend.models.tender import SourceSystem, Tender


def _t(eid: str, *, cpv: str = "45233120", county: str | None = "Iasi", age_h: float = 1, url: bool = True,
       deadline_h: float | None = 100) -> Tender:
    now = datetime.now(UTC)
    return Tender(
        source_system=SourceSystem.ROMANIA_SEAP, external_id=eid, country_code="RO", title=f"Tender {eid}",
        cpv_codes=[cpv], county=county, publication_date=now - timedelta(hours=age_h),
        submission_deadline=None if deadline_h is None else now + timedelta(hours=deadline_h),
        source_url=f"https://e-licitatie.ro/{eid}" if url else None,
    )


def test_map_tenders_is_public_and_filters(api: TestClient) -> None:
    with Session(engine) as s:
        s.add_all([
            _t("new-iasi", county="Iasi", age_h=2),
            _t("old-iasi", county="Iași", age_h=1),  # newer, same county after accent folding
            _t("stale", county="Cluj", age_h=30),
            _t("it", cpv="30200000", county="Bacau"),
            _t("closed", county="Dolj", deadline_h=-1),
            _t("nourl", county="Arad", url=False),
            _t("nocounty", county=None),
        ])
        s.commit()
    r = api.get("/api/public/map-tenders")  # no Authorization header
    assert r.status_code == 200
    assert "s-maxage" in r.headers["cache-control"]
    assert [t["id"] for t in r.json()] == ["old-iasi"]
    assert r.json()[0]["url"] == "https://e-licitatie.ro/old-iasi"
