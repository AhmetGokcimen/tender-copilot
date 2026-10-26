"""Optional shared-secret API key. Disabled by default (settings.api_key
empty) so local frontend integration needs zero setup; set API_KEY in the
environment to require it once this is deployed somewhere public."""

from fastapi import Header, HTTPException

from core.config import settings


def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    if not settings.api_key:
        return
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Missing or invalid X-API-Key header")
