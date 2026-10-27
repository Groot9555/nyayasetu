"""Export the ChromaDB index to static files for the browser-only (Netlify) build.

Writes frontend/public/index/chunks.json (text + metadata), embeddings.bin (float32, row-major) and documents.json.
Run after scripts/ingest_documents.py.
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.config import get_settings  # noqa: E402
import chromadb  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "index"


def main() -> None:
    s = get_settings()
    col = chromadb.PersistentClient(path=str(s.chroma_dir)).get_collection(s.collection_name)
    data = col.get(include=["documents", "metadatas", "embeddings"])
    emb = np.asarray(data["embeddings"], dtype=np.float32)
    emb /= np.linalg.norm(emb, axis=1, keepdims=True)
    OUT.mkdir(parents=True, exist_ok=True)
    chunks = [{"id": i, "text": d, "meta": m} for i, d, m in zip(data["ids"], data["documents"], data["metadatas"])]
    (OUT / "chunks.json").write_text(json.dumps({"dim": emb.shape[1], "chunks": chunks}, ensure_ascii=False))
    (OUT / "embeddings.bin").write_bytes(emb.tobytes())
    manifest = json.loads((s.documents_dir / "sources.json").read_text())
    (OUT / "documents.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print(f"exported {len(chunks)} chunks, dim={emb.shape[1]} -> {OUT}")


if __name__ == "__main__":
    main()
