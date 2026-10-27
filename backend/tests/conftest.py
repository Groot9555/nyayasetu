import os
import sys
from pathlib import Path

os.environ.setdefault("EMBEDDING_BACKEND", "hash")
os.environ.setdefault("LLM_PROVIDER", "none")
os.environ.setdefault("RATE_LIMIT_PER_MINUTE", "0")
os.environ.setdefault("FRONTEND_ORIGIN", "http://localhost:5173")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import chromadb  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import Settings  # noqa: E402
from app.main import app  # noqa: E402
from app.services import container  # noqa: E402
from app.services.complaint_service import ComplaintService  # noqa: E402
from app.services.embeddings import HashEmbedder  # noqa: E402
from app.services.legal_decoder_service import LegalDecoderService  # noqa: E402
from app.services.rag_service import RAGService  # noqa: E402
from app.services.retrieval_service import RetrievalService  # noqa: E402
from app.services.rights_service import RightsService  # noqa: E402

# Small fixture corpus (test data only; mirrors the shape of indexed statute chunks).
FIXTURE_CHUNKS = [
    ("it_act_2000", "Information Technology Act, 2000", "66C", "Punishment for identity theft",
     "66C. Punishment for identity theft.—Whoever, fraudulently or dishonestly make use of the electronic "
     "signature, password or any other unique identification feature of any other person, shall be punished."),
    ("it_act_2000", "Information Technology Act, 2000", "2", "Definitions",
     "2. Definitions.—(k) computer resource means computer, computer system, computer network, data, "
     "computer data base or software."),
    ("motor_vehicles_act_1988", "Motor Vehicles Act, 1988", "129", "Wearing of protective headgear",
     "129. Wearing of protective headgear.—Every person driving or riding a motor cycle shall wear "
     "protective headgear (helmet) conforming to the standards."),
    ("motor_vehicles_act_1988", "Motor Vehicles Act, 1988", "2", "Definitions",
     "2. Definitions.—(10) driver includes, in relation to a motor vehicle which is drawn by another."),
]


class FakeLLM:
    def __init__(self, reply: str = "Explanation:\nUsing another person's password may be identity theft [1]. [9]"):
        self.reply = reply
        self.calls: list[tuple[str, str]] = []

    def complete(self, system: str, user: str) -> str:
        self.calls.append((system, user))
        return self.reply


class SpyRetrieval(RetrievalService):
    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.search_calls: list[str] = []

    def search(self, query, *a, **kw):
        self.search_calls.append(query)
        return super().search(query, *a, **kw)


@pytest.fixture
def retrieval(tmp_path):
    settings = Settings(embedding_backend="hash", chroma_dir=tmp_path, collection_name="test",
                        retrieval_strong_distance=0.5, retrieval_max_distance=0.85)
    client = chromadb.EphemeralClient()
    try:
        client.delete_collection("test")
    except Exception:
        pass
    r = SpyRetrieval(settings, HashEmbedder(), client=client)
    emb = HashEmbedder()
    r.collection.add(
        ids=[f"c{i}" for i in range(len(FIXTURE_CHUNKS))],
        documents=[c[4] for c in FIXTURE_CHUNKS],
        embeddings=emb.embed([c[4] for c in FIXTURE_CHUNKS]),
        metadatas=[{"doc_id": d, "title": a, "act_name": a, "short_name": "", "section": s, "section_title": t,
                    "url": f"https://www.indiacode.nic.in/{d}.pdf", "chunk_index": 0, "jurisdiction": "India",
                    "legal_status": "", "date_checked": "2026-10-27", "version": ""}
                   for d, a, s, t, _ in FIXTURE_CHUNKS],
    )
    return r


def make_client(retrieval, llm=None) -> TestClient:
    rag = RAGService(retrieval, llm)
    app.dependency_overrides[container.get_retrieval] = lambda: retrieval
    app.dependency_overrides[container.get_rag] = lambda: rag
    app.dependency_overrides[container.get_decoder] = lambda: LegalDecoderService(rag)
    app.dependency_overrides[container.get_rights] = lambda: RightsService(rag)
    app.dependency_overrides[container.get_complaints] = lambda: ComplaintService(retrieval)
    return TestClient(app)


@pytest.fixture
def client(retrieval):
    yield make_client(retrieval)
    app.dependency_overrides.clear()


@pytest.fixture
def llm_client(retrieval):
    llm = FakeLLM()
    c = make_client(retrieval, llm)
    c.llm = llm
    yield c
    app.dependency_overrides.clear()
