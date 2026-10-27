"""Lazily constructed singletons, exposed as FastAPI dependencies (overridable in tests)."""

from functools import lru_cache

from ..config import get_settings
from .complaint_service import ComplaintService
from .embeddings import build_embedder
from .legal_decoder_service import LegalDecoderService
from .llm_service import build_llm_client
from .rag_service import RAGService
from .retrieval_service import RetrievalService
from .rights_service import RightsService


@lru_cache
def get_retrieval() -> RetrievalService:
    s = get_settings()
    return RetrievalService(s, build_embedder(s.embedding_backend))


@lru_cache
def get_rag() -> RAGService:
    return RAGService(get_retrieval(), build_llm_client(get_settings()))


def get_decoder() -> LegalDecoderService:
    return LegalDecoderService(get_rag())


def get_rights() -> RightsService:
    return RightsService(get_rag())


def get_complaints() -> ComplaintService:
    return ComplaintService(get_retrieval())
