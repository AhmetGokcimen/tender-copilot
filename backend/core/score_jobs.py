"""Score-job lifecycle: spawn helpers (request path) + background worker.

Mirrors core.caiet_jobs: the worker reuses the production scoring path
unchanged (core.scoring.evaluate + db.upsert_score, same no-clobber
guarantees), processing tenders in batches so the job row reports
honest processed/total progress. Score upserts are idempotent, so a
reaped-then-reposted job simply replays.
"""

from datetime import UTC, datetime

from sqlmodel import Session, func, select

from backend.core.scoring import evaluate
from backend.db import engine, insert_scores, upsert_score
from backend.models.company import CompanyProfile
from backend.models.ocr_job import ACTIVE_JOB_STATUSES
from backend.models.score_job import ScoreJob
from backend.models.tender import Tender
from backend.models.user_tender_state import UserTenderState

BATCH_SIZE = 100


def create_job(session: Session, company_id: int) -> ScoreJob:
    job = ScoreJob(company_id=company_id)
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def get_active_job(session: Session, company_id: int) -> ScoreJob | None:
    """A still-unfinished job for this company, if any — the POST handler
    returns it instead of spawning a duplicate full-table rescore."""
    return session.exec(
        select(ScoreJob)
        .where(
            ScoreJob.company_id == company_id,
            ScoreJob.status.in_(ACTIVE_JOB_STATUSES),
        )
        .order_by(ScoreJob.id.desc())
    ).first()


def get_latest_job(session: Session, company_id: int) -> ScoreJob | None:
    return session.exec(
        select(ScoreJob)
        .where(ScoreJob.company_id == company_id)
        .order_by(ScoreJob.id.desc())
    ).first()


def reap_stale_jobs(session: Session) -> int:
    """Fail jobs left running/pending by a previous process lifetime —
    BackgroundTasks are in-process, so a restart orphans them. Same
    rationale as caiet_jobs.reap_stale_jobs."""
    stale = session.exec(
        select(ScoreJob).where(ScoreJob.status.in_(ACTIVE_JOB_STATUSES))
    ).all()
    for job in stale:
        job.status = "failed"
        job.error = "Server restarted while this job was unfinished — retry."
        job.updated_at = datetime.now(UTC)
        session.add(job)
    session.commit()
    return len(stale)


def run_score_job(job_id: int, *, batch_size: int = BATCH_SIZE) -> None:
    """Background worker. Own DB session (never the request's). Every
    outcome lands on the job row — nothing raises past this point.

    Deliberately sync: Starlette runs sync background tasks in a
    threadpool, keeping the event loop free for polls and other
    requests. An async def with no awaits would wedge the whole
    single-worker server for the job's full duration."""
    with Session(engine) as session:
        job = session.get(ScoreJob, job_id)
        if job is None:
            return
        company = session.get(CompanyProfile, job.company_id)
        if company is None:
            job.status = "failed"
            job.error = "Company no longer exists."
            job.updated_at = datetime.now(UTC)
            session.add(job)
            session.commit()
            return

        job.status = "running"
        job.total = session.exec(select(func.count()).select_from(Tender)).one()
        job.processed = 0
        job.updated_at = datetime.now(UTC)
        session.add(job)
        session.commit()

        try:
            offset = 0
            while True:
                batch = session.exec(
                    select(Tender)
                    .order_by(Tender.source_system, Tender.external_id)
                    .offset(offset)
                    .limit(batch_size)
                ).all()
                if not batch:
                    break
                for tender in batch:
                    result = evaluate(tender, company)
                    upsert_score(
                        session,
                        tender_source_system=tender.source_system,
                        tender_external_id=tender.external_id,
                        company_id=company.id,
                        score=result.score,
                        reasons=result.reasons,
                    )
                offset += len(batch)
                job.processed = offset
                job.updated_at = datetime.now(UTC)
                session.add(job)
                session.commit()
            job.status = "done"
        except Exception as e:  # noqa: BLE001 — recorded on the row, see docstring
            job.status = "failed"
            job.error = f"{type(e).__name__}: {e}"
        job.updated_at = datetime.now(UTC)
        session.add(job)
        session.commit()


LAZY_SCORE_CAP = 3000


def score_unscored(
    session: Session,
    company: CompanyProfile,
    tenders: list[Tender],
    states: dict[tuple, UserTenderState],
) -> None:
    """Score, on the spot, the tenders this company has no state for yet, and
    add the new rows to `states`. Scoring is a cheap rule check (no AI), so
    the feed and the detail page never show an empty score just because no
    scoring job ran (new company, or tenders synced since the last job)."""
    rows = []
    for tender in tenders:
        key = (tender.source_system, tender.external_id)
        existing = states.get(key)
        if existing is not None and existing.score is not None:
            continue
        if len(rows) >= LAZY_SCORE_CAP:
            break
        result = evaluate(tender, company)
        rows.append(
            {
                "tender_source_system": tender.source_system,
                "tender_external_id": tender.external_id,
                "company_id": company.id,
                "score": result.score,
                "reasons": result.reasons,
            }
        )
    if not rows:
        return
    # Rows that exist without a score get it through the normal upsert; new ones in bulk.
    fresh = [r for r in rows if (r["tender_source_system"], r["tender_external_id"]) not in states]
    for r in rows:
        if r in fresh:
            continue
        upsert_score(
            session,
            tender_source_system=r["tender_source_system"],
            tender_external_id=r["tender_external_id"],
            company_id=r["company_id"],
            score=r["score"],
            reasons=r["reasons"],
        )
    insert_scores(session, fresh)
    for state in session.exec(
        select(UserTenderState).where(
            UserTenderState.company_id == company.id,
            UserTenderState.tender_external_id.in_([r["tender_external_id"] for r in rows]),
        )
    ).all():
        states[(state.tender_source_system, state.tender_external_id)] = state
