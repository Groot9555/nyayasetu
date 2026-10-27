from typing import Literal, Optional

from pydantic import BaseModel, Field

from .common import DISCLAIMER, SourceReference


class OfficialResource(BaseModel):
    name: str
    url: str
    note: Optional[str] = None


class RightsTopic(BaseModel):
    id: str
    title: str
    summary: str
    description: str
    clarifying_questions: list[str]
    official_resources: list[OfficialResource]
    support_level: Literal["indexed", "limited"]


class RightsRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=50)
    description: str = Field(default="", max_length=3000)
    jurisdiction: Optional[str] = Field(default=None, max_length=100)


class RightsResponse(BaseModel):
    topic: RightsTopic
    status: Literal["ok", "needs_more_detail", "insufficient_evidence"]
    explanation: str
    next_steps: list[str]
    next_steps_basis: str
    sources: list[SourceReference]
    uncertainty: Optional[str] = None
    disclaimer: str = DISCLAIMER
