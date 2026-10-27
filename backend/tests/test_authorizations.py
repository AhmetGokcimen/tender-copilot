"""CountryAuthorization model helpers + country requirements reference."""

import pytest
from sqlmodel import Session, select

from models.company import CompanyProfile
from models.country_authorization import CountryAuthorization


@pytest.fixture()
def session(api):
    from db import engine

    with Session(engine) as session:
        yield session


def _company(session: Session) -> int:
    session.add(CompanyProfile(name="Co"))
    session.commit()
    return session.exec(select(CompanyProfile)).one().id


def test_upsert_creates_then_updates(session: Session) -> None:
    from core.authorizations import upsert_authorization

    company_id = _company(session)
    first = upsert_authorization(session, company_id, "ro", "in_progress", "Filed ONRC forms")
    assert (first.country_code, first.status) == ("RO", "in_progress")
    assert first.requirement_notes == "Filed ONRC forms"
    assert first.updated_at is not None

    second = upsert_authorization(session, company_id, "RO", "obtained")
    assert second.id == first.id  # same (company, country) row
    assert second.status == "obtained"
    assert second.requirement_notes == "Filed ONRC forms"  # untouched fields survive


def test_upsert_validates_status_and_code(session: Session) -> None:
    from core.authorizations import upsert_authorization

    company_id = _company(session)
    with pytest.raises(ValueError, match="status"):
        upsert_authorization(session, company_id, "RO", "maybe")
    with pytest.raises(ValueError, match="country_code"):
        upsert_authorization(session, company_id, "Romania", "obtained")
    rows = session.exec(select(CountryAuthorization)).all()
    assert rows == []


def test_ensure_rows_only_adds_missing(session: Session) -> None:
    from core.authorizations import ensure_authorization_rows, upsert_authorization

    company_id = _company(session)
    upsert_authorization(session, company_id, "RO", "obtained")
    ensure_authorization_rows(session, company_id, ["RO", "BG"])
    rows = {
        r.country_code: r.status
        for r in session.exec(select(CountryAuthorization)).all()
    }
    assert rows == {"RO": "obtained", "BG": "not_started"}


def test_status_map_empty_without_company(session: Session) -> None:
    from core.authorizations import authorization_status_map

    assert authorization_status_map(session, None) == {}


def test_romania_guide_is_informational_not_advice() -> None:
    from core.country_requirements import get_country_requirements

    ro = get_country_requirements("RO")
    assert ro["guide_available"] is True
    assert "ONRC" in ro["guidance"]
    assert "not legal advice" in ro["guidance"].lower()


def test_planned_countries_return_placeholders() -> None:
    from core.country_requirements import get_country_requirements

    pl = get_country_requirements("pl")  # case-insensitive
    assert (pl["country_code"], pl["name"]) == ("PL", "Poland")
    assert pl["guide_available"] is False
    assert "coming soon" in pl["guidance"].lower()

    xx = get_country_requirements("XX")
    assert xx["guide_available"] is False
    assert xx["name"] is None
