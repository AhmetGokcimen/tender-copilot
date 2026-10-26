"""Meta AI model client: summarization, title simplification/translation,
and structured clause extraction from tender specification text.

Every prompt must instruct the model to justify rather than just decide,
and to say so rather than guess when uncertain. Calls use a JSON schema
constraint with retry + fallback (implementation follows architecture
confirmation).
"""

from app.core.config import settings


class MetaAIClient:
    def __init__(self) -> None:
        self.api_key = settings.meta_api_key
        self.base_url = settings.meta_api_base_url

    async def summarize_justification(self, tender_text: str) -> str:
        raise NotImplementedError

    async def simplify_title(self, title: str) -> str:
        raise NotImplementedError

    async def extract_requirements(self, specification_text: str) -> dict:
        raise NotImplementedError
