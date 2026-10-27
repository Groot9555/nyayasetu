import logging
import re
from dataclasses import dataclass
from typing import Any

import chromadb

from ..config import Settings
from ..schemas.common import SourceReference
from .embeddings import Embedder

log = logging.getLogger(__name__)

# Words too generic to show that a passage is about the user's actual topic.
GENERIC_WORDS = set("""
a an the and or of to in on for by with without from at as is are was were be been being am do does did done
what which who whom whose when where why how can could should would will shall may might must not no yes
i me my mine we our you your he she it its they them their this that these those there here any some all
about under into over than then also just only very more most such other another
law laws legal act acts section sections rule rules india indian court case cases right rights
punishment punish punishable penalty penalties offence offences offense fine fines provision provisions
mean means meaning define definition explain tell know need want get happen happens happened someone person
""".split())


def query_keywords(query: str) -> set[str]:
    return {w for w in re.findall(r"[a-z][a-z\-]{2,}", query.lower()) if w not in GENERIC_WORDS}


def shares_keyword(keywords: set[str], text: str) -> bool:
    low = text.lower()
    return any(kw[:5] in low for kw in keywords)


@dataclass
class Passage:
    id: str
    text: str
    metadata: dict[str, Any]
    distance: float

    @property
    def relevance(self) -> float:
        return round(1.0 - self.distance, 3)

    def to_source(self, excerpt_chars: int = 600) -> SourceReference:
        md = self.metadata
        excerpt = self.text if len(self.text) <= excerpt_chars else self.text[:excerpt_chars].rstrip() + " …"
        return SourceReference(
            doc_id=md.get("doc_id", ""),
            title=md.get("title", ""),
            act_name=md.get("act_name", ""),
            section=md.get("section") or None,
            section_title=md.get("section_title") or None,
            url=md.get("url") or None,
            excerpt=excerpt,
            relevance=self.relevance,
        )


class RetrievalService:
    def __init__(self, settings: Settings, embedder: Embedder, client: Any | None = None):
        self.settings = settings
        self.embedder = embedder
        self.client = client or chromadb.PersistentClient(path=str(settings.chroma_dir))
        self.collection = self.client.get_or_create_collection(
            name=settings.collection_name, metadata={"hnsw:space": "cosine"}, embedding_function=None
        )

    def count(self) -> int:
        return self.collection.count()

    def list_documents(self) -> list[dict[str, Any]]:
        if self.count() == 0:
            return []
        res = self.collection.get(include=["metadatas"])
        docs: dict[str, dict[str, Any]] = {}
        for md in res["metadatas"]:
            d = docs.setdefault(md["doc_id"], {**{k: md.get(k) for k in (
                "doc_id", "title", "act_name", "short_name", "jurisdiction", "legal_status",
                "url", "date_checked", "version")}, "chunks": 0})
            d["chunks"] += 1
        return sorted(docs.values(), key=lambda d: d["title"] or "")

    def search(
        self, query: str, k: int | None = None, doc_ids: list[str] | None = None, apply_threshold: bool = True
    ) -> list[Passage]:
        if self.count() == 0:
            return []
        k = k or self.settings.retrieval_top_k
        where = None
        if doc_ids:
            where = {"doc_id": doc_ids[0]} if len(doc_ids) == 1 else {"doc_id": {"$in": doc_ids}}
        emb = self.embedder.embed([query])
        res = self.collection.query(
            query_embeddings=emb, n_results=min(k, self.count()), where=where,
            include=["documents", "metadatas", "distances"],
        )
        passages = [
            Passage(id=i, text=t, metadata=m, distance=float(d))
            for i, t, m, d in zip(res["ids"][0], res["documents"][0], res["metadatas"][0], res["distances"][0])
        ]
        if apply_threshold:
            passages = self.filter_relevant(query, passages)
        # keep only the best-matching chunk per section to avoid duplicate references
        seen: set[tuple[str, str]] = set()
        unique = []
        for p in passages:
            key = (p.metadata.get("doc_id", ""), p.metadata.get("section") or p.id)
            if key not in seen:
                seen.add(key)
                unique.append(p)
        passages = unique
        log.debug("retrieved %d passages", len(passages))
        return passages

    def filter_relevant(self, query: str, passages: list[Passage]) -> list[Passage]:
        keywords = query_keywords(query)
        kept = []
        for p in passages:
            if p.distance <= self.settings.retrieval_strong_distance:
                kept.append(p)
            elif p.distance <= self.settings.retrieval_max_distance and keywords and shares_keyword(
                keywords, f"{p.metadata.get('section_title', '')} {p.text}"
            ):
                kept.append(p)
        return kept

    def get_section(self, section: str, doc_id: str | None = None) -> list[Passage]:
        where: dict[str, Any] = {"section": section}
        if doc_id:
            where = {"$and": [{"section": section}, {"doc_id": doc_id}]}
        res = self.collection.get(where=where, include=["documents", "metadatas"])
        passages = [Passage(id=i, text=t, metadata=m, distance=0.0)
                    for i, t, m in zip(res["ids"], res["documents"], res["metadatas"])]
        passages.sort(key=lambda p: (p.metadata.get("doc_id", ""), p.metadata.get("chunk_index", 0)))
        return passages
