"""Deadline reminders: due tenders are e-mailed once, only for tracked ones."""

import asyncio
from datetime import UTC, datetime, timedelta

from sqlmodel import Session

from backend.core import reminders
from backend.db import engine, init_db
from backend.models.company import CompanyProfile
from backend.models.tender import SourceSystem, Tender
from backend.models.user import User
from backend.models.user_company import UserCompany
from backend.models.user_tender_state import UserTenderState


def _seed(session: Session, tag: str = "a") -> int:
    now = datetime.now(UTC)
    user = User(subject=f"supabase:{tag}", email="a@x.ro", name="Ana Pop", provider="supabase")
    company = CompanyProfile(name="Co")
    session.add_all([user, company])
    session.commit()
    session.add(UserCompany(user_id=user.id, company_id=company.id))
    for ext, days, status in ((f"{tag}1", 2, "reviewing"), (f"{tag}2", 20, "reviewing"), (f"{tag}3", 1, "new"), (f"{tag}4", 3, "applied")):
        session.add(
            Tender(source_system=SourceSystem.ROMANIA_SEAP, external_id=ext, country_code="RO", title=f"Tender {ext}",
                   submission_deadline=now + timedelta(days=days, hours=1))
        )
        session.add(
            UserTenderState(tender_source_system=SourceSystem.ROMANIA_SEAP, tender_external_id=ext,
                            company_id=company.id, score=80, status=status)
        )
    session.commit()
    return user.id


def test_reminds_once_for_tracked_tenders_inside_the_lead_time() -> None:
    init_db()
    sent: list[tuple[str, str, str]] = []

    async def fake_send(to, subject, text, html):  # noqa: ANN001
        sent.append((to, subject, text))
        return "sent"

    with Session(engine) as session:
        uid = _seed(session, "r1")
        people = [{"user_id": uid, "email": "a@x.ro", "name": "Ana Pop", "company": "Co", "lead": 7}]
        first = asyncio.run(reminders.send_deadline_reminders(session, send=fake_send, people=people))
        again = asyncio.run(reminders.send_deadline_reminders(session, send=fake_send, people=people))
    assert first["sent"] == 1 and again["sent"] == 0
    (to, subject, text), = sent
    assert to == "a@x.ro" and "Tender r11" in text
    assert "r12" not in text and "r13" not in text and "r14" not in text  # too far, not tracked, already applied


def test_shorter_lead_time_waits() -> None:
    init_db()
    sent: list[str] = []

    async def fake_send(to, subject, text, html):  # noqa: ANN001
        sent.append(to)
        return "sent"

    with Session(engine) as session:
        uid = _seed(session, "r2")
        people = [{"user_id": uid, "email": "b@x.ro", "name": "B", "company": "Co", "lead": 1}]
        out = asyncio.run(reminders.send_deadline_reminders(session, send=fake_send, people=people))
    assert out["sent"] == 0 and sent == []  # t1 is 2 days away, lead is 1
