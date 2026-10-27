"""Caiet-job lifecycle: spawn helpers (request path) + background worker.

The worker reuses the production pieces unchanged — adapter caiet
download, ai.ocr merge, extract_requirements schema — and additionally
writes its outcome onto the Tender row, so the feed/detail screens show
the extraction once the job is done.
"""

from datetime import UTC, datetime

from sqlmodel import Session, select

from adapters.romania_seap.adapter import RomaniaSeapAdapter
from ai.ocr import extract_requirements_from_pdf
from db import engine, upsert_tender_extraction
from models.ocr_job import ACTIVE_JOB_STATUSES, OcrJob
from models.tender import SourceSystem, Tender


def create_job(
    session: Session, source_system: SourceSystem, external_id: str
) -> OcrJob:
    job = OcrJob(
        tender_source_system=source_system, tender_external_id=external_id
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def get_active_job(
    session: Session, source_system: SourceSystem, external_id: str
) -> OcrJob | None:
    """A still-unfinished job for this tender, if any — the POST handler
    returns it instead of spawning (and paying for) a duplicate."""
    return session.exec(
        select(OcrJob)
        .where(
            OcrJob.tender_source_system == source_system,
            OcrJob.tender_external_id == external_id,
            OcrJob.status.in_(ACTIVE_JOB_STATUSES),
        )
        .order_by(OcrJob.id.desc())
    ).first()


def get_latest_job(
    session: Session, source_system: SourceSystem, external_id: str
) -> OcrJob | None:
    return session.exec(
        select(OcrJob)
        .where(
            OcrJob.tender_source_system == source_system,
            OcrJob.tender_external_id == external_id,
        )
        .order_by(OcrJob.id.desc())
    ).first()


async def run_caiet_job(job_id: int, *, adapter: RomaniaSeapAdapter | None = None) -> None:
    """Background worker. Own DB session (never the request's). Every
    outcome lands on the job row — nothing raises past this point."""
    worker_adapter = adapter or RomaniaSeapAdapter()
    with Session(engine) as session:
        job = session.get(OcrJob, job_id)
        if job is None:
            return
        job.status = "running"
        job.updated_at = datetime.now(UTC)
        session.add(job)
        session.commit()

        try:
            tender = session.get(Tender, (job.tender_source_system, job.tender_external_id))
            if tender is None or tender.notice_type_id is None:
                raise ValueError("Tender missing or has no notice_type_id")
            caiet = await worker_adapter.fetch_caiet_pdf(
                job.tender_external_id, tender.notice_type_id
            )
            if caiet is None:
                raise ValueError("Tender dossier has no caiet de sarcini file")
            extracted, pdf = await extract_requirements_from_pdf(caiet.pdf_bytes)
            upsert_tender_extraction(
                session,
                source_system=tender.source_system,
                external_id=tender.external_id,
                extracted_requirements=extracted.model_dump(
                    exclude={"extraction_confidence"}
                ),
                extraction_confidence=extracted.extraction_confidence,
            )
            job.status = "done"
            job.result = {
                "caiet_name": caiet.name,
                "extracted_requirements": extracted.model_dump(
                    exclude={"extraction_confidence"}
                ),
                "extraction_confidence": extracted.extraction_confidence,
                "ocr_pages": pdf.ocr_pages,
                "scanned_pages": pdf.scanned_pages,
                "truncated": pdf.truncated,
            }
        except Exception as e:  # noqa: BLE001 — recorded on the row, see docstring
            job.status = "failed"
            job.error = f"{type(e).__name__}: {e}"
        job.updated_at = datetime.now(UTC)
        session.add(job)
        session.commit()
