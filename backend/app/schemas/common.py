from typing import Literal, Optional

from pydantic import BaseModel, Field

DISCLAIMER = (
    "General legal information, not legal advice. NyayaSetu can be wrong or incomplete. "
    "Verify with the official source and consult a qualified lawyer or the appropriate authority."
)

Language = Literal["en"]


class SourceReference(BaseModel):
    doc_id: str
    title: str
    act_name: str
    section: Optional[str] = None
    section_title: Optional[str] = None
    url: Optional[str] = None
    excerpt: Optional[str] = None
    relevance: Optional[float] = Field(default=None, description="1 - cosine distance (higher is more relevant)")


class HealthResponse(BaseModel):
    status: str
    api_version: str
    llm_mode: Literal["generated", "extractive"]
    indexed_chunks: int
    indexed_documents: int
