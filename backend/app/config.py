from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "NyayaSetu API"
    api_version: str = "0.1.0"
    environment: str = "development"

    frontend_origin: str = "http://localhost:5173"

    documents_dir: Path = BACKEND_DIR / "data" / "documents"
    chroma_dir: Path = BACKEND_DIR / "data" / "chroma"
    collection_name: str = "nyayasetu_legal"

    # "default" = ChromaDB's bundled all-MiniLM-L6-v2 (ONNX, runs locally); "hash" = offline test embedder
    embedding_backend: str = "default"

    # "none" = extractive mode (no generated text); "openai" = any OpenAI-compatible chat completions API
    llm_provider: str = "none"
    llm_api_key: str = Field(default="", repr=False)
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: float = 60.0
    llm_temperature: float = 0.1

    retrieval_top_k: int = 5
    # Cosine distance thresholds. Passages closer than `strong` are accepted; passages up to `max` are accepted
    # only if they also share a meaningful keyword with the query; anything farther is discarded.
    retrieval_strong_distance: float = 0.40
    retrieval_max_distance: float = 0.70

    max_request_bytes: int = 32_000
    rate_limit_per_minute: int = 30
    log_level: str = "INFO"

    @property
    def llm_enabled(self) -> bool:
        return self.llm_provider.lower() != "none" and bool(self.llm_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
