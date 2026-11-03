"""Deadline reminders for the tenders a user is working on.

A tender counts as tracked when its state for the user's company is
"reviewing" (the Preparing column). A user is e-mailed once per tender when
its deadline is within the lead time set in their profile (`min_days_to_deadline`
on the company, in days) and e-mail notifications are on. One message lists
every tender that became due, in English and Romanian.
"""

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlmodel import Session, select

from backend.core import mail
from backend.core.config import settings
from backend.db import BACKEND_SCHEMA
from backend.models.reminder_log import ReminderLog
from backend.models.tender import Tender
from backend.models.user_company import UserCompany
from backend.models.user_tender_state import UserTenderState

Sender = Callable[[str, str, str, str | None], Awaitable[str]]


def recipients(session: Session) -> list[dict]:
    """Users with e-mail alerts on, and their lead time. The profile settings live
    in Supabase's public.companies, in the same database as this schema; a
    Supabase user id is the part of subject after "supabase:"."""
    rows = session.execute(
        text(
            f"""
            select distinct u.id as user_id, u.email, u.name, c.name as company, c.min_days_to_deadline as lead
            from {BACKEND_SCHEMA}.app_user u
            join public.company_members m on m.user_id::text = substr(u.subject, 10)
            join public.companies c on c.id = m.company_id
            where u.subject like 'supabase:%' and c.notify_email and c.notify_frequency <> 'off'
            """
        )
    ).mappings()
    return [dict(r) for r in rows]


def _days_left(deadline: datetime, now: datetime) -> int:
    d = deadline if deadline.tzinfo else deadline.replace(tzinfo=UTC)
    return max(0, (d - now).days)


def _message(name: str, due: list[tuple[Tender, int]]) -> tuple[str, str, str]:
    first = due[0][1]
    when_en = "today" if first == 0 else f"in {first} day{'s' if first != 1 else ''}"
    when_ro = "astăzi" if first == 0 else f"peste {first} {'zi' if first == 1 else 'zile'}"
    if len(due) == 1:
        subject = f"Deadline {when_en}: {due[0][0].ai_title_simplified or due[0][0].title}"[:140]
    else:
        subject = f"{len(due)} tenders you follow are due soon"
    lines_en, lines_ro = [], []
    for tender, left in due:
        title = tender.ai_title_simplified or tender.title
        url = f"{settings.site_url}/en/app/tenders/{tender.external_id}"
        deadline = tender.submission_deadline.strftime("%d.%m.%Y") if tender.submission_deadline else "-"
        lines_en.append(f"- {title}\n  {tender.contracting_authority or ''}\n  Deadline {deadline} ({left} days left)\n  {url}")
        lines_ro.append(f"- {tender.title}\n  {tender.contracting_authority or ''}\n  Termen {deadline} (mai sunt {left} zile)\n  {url.replace('/en/', '/ro/')}")
    body = (
        f"Hello {name.split(' ')[0] if name else ''},\n\n"
        f"These tenders in your Preparing list are due soon ({when_en}):\n\n" + "\n\n".join(lines_en)
        + "\n\n---\n\n"
        f"Licitațiile din lista Pregătire au termen apropiat ({when_ro}):\n\n" + "\n\n".join(lines_ro)
        + "\n\nYou receive this because deadline reminders are on in your profile. Change or turn them off under Profile > Notifications."
    )
    html = "<p>" + body.replace("&", "&amp;").replace("<", "&lt;").replace("\n\n", "</p><p>").replace("\n", "<br>") + "</p>"
    return subject, body, html


async def send_deadline_reminders(
    session: Session,
    *,
    now: datetime | None = None,
    send: Sender = mail.send_email,
    people: list[dict] | None = None,
    dry_run: bool = False,
) -> dict:
    now = now or datetime.now(UTC)
    people = recipients(session) if people is None else people
    sent = skipped = failed = 0
    results: list[str] = []
    for person in people:
        lead = int(person.get("lead") or 0)
        if lead <= 0:
            continue
        company_ids = [
            uc.company_id for uc in session.exec(select(UserCompany).where(UserCompany.user_id == person["user_id"]))
        ]
        if not company_ids:
            continue
        horizon = now + timedelta(days=lead)
        rows = session.exec(
            select(UserTenderState, Tender)
            .join(
                Tender,
                (Tender.source_system == UserTenderState.tender_source_system)
                & (Tender.external_id == UserTenderState.tender_external_id),
            )
            .where(UserTenderState.company_id.in_(company_ids), UserTenderState.status == "reviewing")  # type: ignore[attr-defined]
        ).all()
        already = {
            r.tender_external_id
            for r in session.exec(select(ReminderLog).where(ReminderLog.user_id == person["user_id"]))
        }
        due: list[tuple[Tender, int]] = []
        seen: set[str] = set()
        for _state, tender in rows:
            deadline = tender.submission_deadline
            if deadline is None or tender.external_id in already or tender.external_id in seen:
                continue
            d = deadline if deadline.tzinfo else deadline.replace(tzinfo=UTC)
            if now <= d <= horizon:
                seen.add(tender.external_id)
                due.append((tender, _days_left(d, now)))
        if not due:
            skipped += 1
            continue
        due.sort(key=lambda x: x[1])
        subject, body, html = _message(person.get("name") or "", due)
        if dry_run:
            results.append(f"{person['email']}: {len(due)} due")
            continue
        outcome = await send(person["email"], subject, body, html)
        if outcome == "sent":
            sent += 1
            for tender, _ in due:
                session.add(ReminderLog(user_id=person["user_id"], tender_external_id=tender.external_id, lead_days=lead))
            session.commit()
        else:
            failed += 1
            results.append(f"{person['email']}: {outcome}")
    return {"people": len(people), "sent": sent, "nothing_due": skipped, "failed": failed, "notes": results[:20], "mail_configured": mail.configured()}
