from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from .common import DISCLAIMER, Language, SourceReference

VerificationStatus = Literal["verified_section", "related_passages", "not_found"]


class DecoderRequest(BaseModel):
    term: str = Field(..., min_length=1, max_length=300, description="Legal term or section, e.g. 'Section 66C'")
    act: Optional[str] = Field(default=None, max_length=100, description="doc_id of an indexed act")
    language: Language = "en"

    @field_validator("term")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Term must not be blank.")
        return v


class DecoderResponse(BaseModel):
    term: str
    original_text: Optional[str] = None
    explanation: str
    conditions: list[str] = []
    sources: list[SourceReference]
    verification_status: VerificationStatus
    mode: Literal["generated", "extractive", "insufficient_evidence"]
    disclaimer: str = DISCLAIMER
