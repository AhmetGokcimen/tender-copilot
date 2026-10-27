"""Async caiet extraction jobs: 202 + reuse + poll + worker paths."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from models.company import CompanyProfile
from models.tender import SourceSystem, Tender


def _seed_tender() -> None:
    from db import engine

    with Session(engine) as session:
        session.add(CompanyProfile(name="Co"))
        session.add(
            Tender(
                source_system=SourceSystem.ROMANIA_SEAP, external_id="1001",
                country_code="RO", notice_type_id=17, title="Roads",
            )
        )
        session.commit()


def _auth() -> dict:
    from core.auth import create_access_token

    token = create_access_token(sub="u", email="u@x.ro", name="U", provider="demo")
    return {"Authorization": f"Bearer {token}"}


def test_post_spawns_job_and_reuses_active(
    api: TestClient, monkeypatch
) -> None:
    from api import routes

    calls: list[int] = []

    async def fake_worker(job_id: int, **kwargs) -> None:
        calls.append(job_id)

    monkeypatch.setattr(routes, "run_caiet_job", fake_worker)
    _seed_tender()

    first = api.post("/api/tenders/romania/1001/extract-caiet", headers=_auth())
    assert first.status_code == 202
    job_id = first.json()["job_id"]
    assert first.json()["status"] == "pending"
    assert calls == [job_id]  # background task picked it up

    second = api.post("/api/tenders/romania/1001/extract-caiet", headers=_auth())
    assert second.status_code == 200
    assert second.json()["job_id"] == job_id  # no duplicate spend
    assert calls == [job_id]


def test_post_validates_tender(api: TestClient) -> None:
    _seed_tender()
    assert api.post("/api/tenders/romania/nope/extract-caiet", headers=_auth()).status_code == 404

    from db import engine

    with Session(engine) as session:
        session.add(
            Tender(
                source_system=SourceSystem.ROMANIA_SEAP, external_id="1002",
                country_code="RO", title="No type id",
            )
        )
        session.commit()
    res = api.post("/api/tenders/romania/1002/extract-caiet", headers=_auth())
    assert res.status_code == 422


def test_get_latest_job(api: TestClient, monkeypatch) -> None:
    from api import routes

    async def fake_worker(job_id: int, **kwargs) -> None:
        pass

    monkeypatch.setattr(routes, "run_caiet_job", fake_worker)
    _seed_tender()
    assert api.get("/api/tenders/romania/1001/extract-caiet", headers=_auth()).status_code == 404
    created = api.post("/api/tenders/romania/1001/extract-caiet", headers=_auth()).json()
    latest = api.get("/api/tenders/romania/1001/extract-caiet", headers=_auth()).json()
    assert latest["job_id"] == created["job_id"]
    assert latest["status"] == "pending"


def test_jobs_need_auth(api: TestClient) -> None:
    assert api.post("/api/tenders/romania/1001/extract-caiet").status_code == 401
    assert api.get("/api/tenders/romania/1001/extract-caiet").status_code == 401


def test_worker_success_writes_tender_and_job(api: TestClient, monkeypatch) -> None:
    import core.caiet_jobs as jobs
    from ai.client import ExtractedRequirements
    from ai.ocr import PdfExtraction
    from db import engine
    from models.ocr_job import OcrJob

    _seed_tender()
    with Session(engine) as session:
        job_id = jobs.create_job(session, SourceSystem.ROMANIA_SEAP, "1001").id

    class StubAdapter:
        async def fetch_caiet_pdf(self, external_id, notice_type_id):
            from adapters.romania_seap.adapter import CaietDocument

            assert (external_id, notice_type_id) == ("1001", 17)
            return CaietDocument(name="caiet.pdf", pdf_bytes=b"%PDF-1.4 x")

    async def fake_extract(pdf_bytes, **kwargs):
        req = ExtractedRequirements(
            minimum_annual_turnover=100.0, turnover_currency="RON",
            extraction_confidence="high",
        )
        pdf = PdfExtraction(
            full_text="t", page_texts=["t"], page_kinds=["text"],
            scanned_pages=[], ocr_pages=0,
        )
        return req, pdf

    monkeypatch.setattr(jobs, "extract_requirements_from_pdf", fake_extract)

    import asyncio

    asyncio.run(jobs.run_caiet_job(job_id, adapter=StubAdapter()))

    with Session(engine) as session:
        done = session.get(OcrJob, job_id)
        assert done.status == "done"
        assert done.result["extraction_confidence"] == "high"
        assert done.result["caiet_name"] == "caiet.pdf"
        tender = session.get(Tender, (SourceSystem.ROMANIA_SEAP, "1001"))
        assert tender.extracted_requirements["minimum_annual_turnover"] == 100.0
        assert tender.extraction_confidence == "high"


def test_worker_failure_paths(api: TestClient) -> None:
    import asyncio

    import core.caiet_jobs as jobs
    from db import engine
    from models.ocr_job import OcrJob

    _seed_tender()

    class NoCaiet:
        async def fetch_caiet_pdf(self, external_id, notice_type_id):
            return None

    class Boom:
        async def fetch_caiet_pdf(self, external_id, notice_type_id):
            raise RuntimeError("seap down")

    with Session(engine) as session:
        missing_id = jobs.create_job(session, SourceSystem.ROMANIA_SEAP, "1001").id
        broken_id = jobs.create_job(session, SourceSystem.ROMANIA_SEAP, "1001").id

    asyncio.run(jobs.run_caiet_job(missing_id, adapter=NoCaiet()))
    asyncio.run(jobs.run_caiet_job(broken_id, adapter=Boom()))

    with Session(engine) as session:
        assert session.get(OcrJob, missing_id).status == "failed"
        assert "caiet" in session.get(OcrJob, missing_id).error.lower()
        failed = session.get(OcrJob, broken_id)
        assert failed.status == "failed"
        assert "seap down" in failed.error
