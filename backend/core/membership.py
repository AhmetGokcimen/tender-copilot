"""Multi-tenant membership: the isolation boundary for company data.

Tenders stay global (SEAP data is the same for everyone); everything keyed
by company — profile, UserTenderState rows, eligibility verdicts — is only
reachable through these helpers, which 403 when the caller's JWT identity
has no UserCompany link to the requested company.
"""

from fastapi import Depends, HTTPException
from sqlmodel import Session, select

from core.auth import CurrentUser
from core.security import get_current_user
from db import get_session
from models.company import CompanyProfile
from models.user import User
from models.user_company import UserCompany


def get_or_create_user(
    session: Session, *, subject: str, email: str, name: str, provider: str
) -> User:
    """Just-in-time provisioning: first authenticated request creates the
    row, later ones refresh claims and return it."""
    user = session.exec(select(User).where(User.subject == subject)).first()
    if user is None:
        user = User(subject=subject, email=email, name=name, provider=provider)
    else:
        user.email = email
        user.name = name
        user.provider = provider
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def link_user_company(
    session: Session, user_id: int, company_id: int, role: str = "owner"
) -> UserCompany:
    link = session.exec(
        select(UserCompany).where(
            UserCompany.user_id == user_id, UserCompany.company_id == company_id
        )
    ).first()
    if link is None:
        link = UserCompany(user_id=user_id, company_id=company_id, role=role)
        session.add(link)
        session.commit()
        session.refresh(link)
    return link


def user_companies(session: Session, user_id: int) -> list[CompanyProfile]:
    return list(
        session.exec(
            select(CompanyProfile)
            .join(UserCompany, UserCompany.company_id == CompanyProfile.id)
            .where(UserCompany.user_id == user_id)
            .order_by(CompanyProfile.id)
        ).all()
    )


def is_member(session: Session, user_id: int, company_id: int) -> bool:
    return (
        session.exec(
            select(UserCompany).where(
                UserCompany.user_id == user_id, UserCompany.company_id == company_id
            )
        ).first()
        is not None
    )


def require_company(
    session: Session, user: User, company_id: int
) -> CompanyProfile:
    """404 when the company doesn't exist, 403 when it exists but isn't the
    caller's — the two cases stay distinguishable for honest errors."""
    company = session.get(CompanyProfile, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    if not is_member(session, user.id, company_id):
        raise HTTPException(status_code=403, detail="Not a member of this company")
    return company


def resolve_user_company(
    session: Session, user: User, company_id: int | None
) -> CompanyProfile | None:
    """Explicit company (membership-checked) or the user's first one. None
    only when no id was given and the user has no company yet — callers
    degrade to default state in that case."""
    if company_id is not None:
        return require_company(session, user, company_id)
    companies = user_companies(session, user.id)
    return companies[0] if companies else None


def get_request_user(
    session: Session = Depends(get_session),
    current: CurrentUser = Depends(get_current_user),
) -> User:
    """Route dependency: the JWT identity as a DB row, provisioned on first
    sight. (FastAPI caches get_session per request, so this shares the
    route's own session.)"""
    return get_or_create_user(
        session,
        subject=current.sub,
        email=current.email,
        name=current.name,
        provider=current.provider,
    )
