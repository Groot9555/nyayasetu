from typing import Optional

from pydantic import BaseModel

from .common import SourceReference


class IndexedDocument(BaseModel):
    doc_id: str
    title: str
    act_name: str
    short_name: Optional[str] = None
    jurisdiction: Optional[str] = None
    legal_status: Optional[str] = None
    url: Optional[str] = None
    date_checked: Optional[str] = None
    version: Optional[str] = None
    chunks: int = 0


class SourceSearchResponse(BaseModel):
    query: str
    results: list[SourceReference]


class DocumentListResponse(BaseModel):
    documents: list[IndexedDocument]
