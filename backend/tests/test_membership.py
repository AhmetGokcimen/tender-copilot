"""Multi-tenant membership helpers: users, links, company resolution."""

import pytest
from fastapi import HTTPException
from sqlmodel import Session

from backend.models.company import CompanyProfile


@pytest.fixture()
def session(api):
    from backend.db import engine

    with Session(engine) as session:
        yield session


def _user(session: Session, sub: str = "u1"):
    from backend.core.membership import get_or_create_user

    return get_or_create_user(
        session, subject=sub, email=f"{sub}@x.ro", name="U", provider="google"
    )


def test_get_or_create_user_is_idempotent(session: Session) -> None:
    first = _user(session)
    second = _user(session)
    assert first.id == second.id
    assert first.subject == "u1"


def test_links_scope_companies_to_user(session: Session) -> None:
    from backend.core.membership import link_user_company, user_companies

    session.add(CompanyProfile(name="A"))
    session.add(CompanyProfile(name="B"))
    session.commit()

    me = _user(session, "me")
    other = _user(session, "other")
    link_user_company(session, me.id, 1)
    link_user_company(session, me.id, 1)  # idempotent
    link_user_company(session, other.id, 2)

    assert [c.id for c in user_companies(session, me.id)] == [1]
    assert [c.id for c in user_companies(session, other.id)] == [2]


def test_require_company_enforces_membership(session: Session) -> None:
    from backend.core.membership import link_user_company, require_company

    session.add(CompanyProfile(name="A"))
    session.commit()
    me = _user(session, "me")
    stranger = _user(session, "stranger")
    link_user_company(session, me.id, 1)

    assert require_company(session, me, 1).name == "A"
    with pytest.raises(HTTPException) as missing:
        require_company(session, me, 999)
    assert missing.value.status_code == 404
    with pytest.raises(HTTPException) as forbidden:
        require_company(session, stranger, 1)
    assert forbidden.value.status_code == 403


def test_resolve_user_company_defaults_to_first(session: Session) -> None:
    from backend.core.membership import link_user_company, resolve_user_company

    session.add(CompanyProfile(name="A"))
    session.add(CompanyProfile(name="B"))
    session.commit()
    me = _user(session, "me")
    assert resolve_user_company(session, me, None) is None  # no companies yet
    link_user_company(session, me.id, 2)
    link_user_company(session, me.id, 1)
    assert resolve_user_company(session, me, None).id == 1
    assert resolve_user_company(session, me, 2).id == 2
