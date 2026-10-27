import logging
from typing import Protocol

import httpx

from ..config import Settings

log = logging.getLogger(__name__)


class LLMUnavailableError(RuntimeError):
    """Raised when the LLM is not configured or the provider call fails."""


class LLMClient(Protocol):
    def complete(self, system: str, user: str) -> str: ...


class OpenAICompatibleClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    def complete(self, system: str, user: str) -> str:
        url = self.settings.llm_base_url.rstrip("/") + "/chat/completions"
        payload = {
            "model": self.settings.llm_model,
            "temperature": self.settings.llm_temperature,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        headers = {"Authorization": f"Bearer {self.settings.llm_api_key}"}
        try:
            resp = httpx.post(url, json=payload, headers=headers, timeout=self.settings.llm_timeout_seconds)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            # Never log the request (contains the key); status code / type only.
            status = getattr(getattr(exc, "response", None), "status_code", None)
            log.warning("LLM provider call failed (%s, status=%s)", type(exc).__name__, status)
            raise LLMUnavailableError("The AI provider is unavailable right now.") from exc


def build_llm_client(settings: Settings) -> LLMClient | None:
    if not settings.llm_enabled:
        return None
    if settings.llm_provider.lower() in ("openai", "openai_compatible"):
        return OpenAICompatibleClient(settings)
    raise ValueError(f"Unsupported LLM provider: {settings.llm_provider}")
