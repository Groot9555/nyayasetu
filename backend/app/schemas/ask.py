from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .common import DISCLAIMER, Language, SourceReference

AnswerMode = Literal["generated", "extractive", "insufficient_evidence"]


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    language: Language = "en"

    @field_validator("question")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Question must contain at least 3 non-space characters.")
        return v


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceReference]
    disclaimer: str = DISCLAIMER
    mode: AnswerMode
