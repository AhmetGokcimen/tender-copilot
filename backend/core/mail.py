"""Sending e-mail.

Two transports, picked by what is configured:

* SMTP: any mailbox with an SMTP login (a personal Gmail with an app password
  works). Set SMTP_USER and SMTP_PASSWORD (and SMTP_HOST / SMTP_PORT for
  something other than Gmail). Messages go out as that mailbox.
* Resend (https://resend.com): RESEND_API_KEY with a verified sender domain.

SMTP wins when both are set. With neither, sending reports "not_configured".
"""

import asyncio
import smtplib
import ssl
from email.message import EmailMessage

import httpx

from backend.core.config import settings


def transport() -> str | None:
    if settings.smtp_user and settings.smtp_password:
        return "smtp"
    if settings.resend_api_key:
        return "resend"
    return None


def configured() -> bool:
    return transport() is not None


def _sender() -> str:
    # With SMTP the mailbox is the sender; providers reject a different From.
    if transport() == "smtp":
        return f"Licits <{settings.smtp_user}>"
    return settings.mail_from


def _send_smtp(to: str, subject: str, text: str, html: str | None) -> str:
    msg = EmailMessage()
    msg["From"] = _sender()
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    try:
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, 465, timeout=20, context=ssl.create_default_context()) as server:
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(msg)
        return "sent"
    except (smtplib.SMTPException, OSError) as e:
        return f"failed: {type(e).__name__} {str(e)[:160]}"


async def send_email(to: str, subject: str, text: str, html: str | None = None) -> str:
    """Send one message. Returns "sent", "not_configured" or "failed: <reason>"."""
    kind = transport()
    if kind is None:
        return "not_configured"
    if kind == "smtp":
        return await asyncio.to_thread(_send_smtp, to, subject, text, html)
    payload: dict = {"from": _sender(), "to": [to], "subject": subject, "text": text}
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
