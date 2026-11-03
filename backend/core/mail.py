"""Sending e-mail through Resend (https://resend.com), plain HTTP, no SDK."""

import httpx

from backend.core.config import settings


def configured() -> bool:
    return bool(settings.resend_api_key)


async def send_email(to: str, subject: str, text: str, html: str | None = None) -> str:
    """Send one message. Returns "sent", "not_configured" or "failed: <reason>"."""
    if not configured():
        return "not_configured"
    payload: dict = {"from": settings.mail_from, "to": [to], "subject": subject, "text": text}
    if html:
        payload["html"] = html
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json=payload,
            )
        if res.status_code >= 300:
            return f"failed: {res.status_code} {res.text[:200]}"
        return "sent"
    except httpx.HTTPError as e:
        return f"failed: {type(e).__name__}"
