"""Index official legal documents into ChromaDB.

Usage (from backend/):  python scripts/ingest_documents.py [--rebuild]

Only PDFs listed in data/documents/sources.json are indexed; that manifest records the verified metadata
(official URL, date checked, legal status) for each document. Unlisted PDFs are skipped as unverified.
"""

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pymupdf  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.services.embeddings import build_embedder  # noqa: E402
from app.services.retrieval_service import RetrievalService  # noqa: E402
from app.services.text_processing import chunk_sections, clean_pages, split_sections  # noqa: E402

REQUIRED_FIELDS = ("file", "doc_id", "title", "act_name", "official_url", "date_checked")
BATCH = 64


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def extract_pages(path: Path) -> list[str]:
    with pymupdf.open(path) as doc:
        return [page.get_text("text") for page in doc]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--rebuild", action="store_true", help="delete the collection and re-index everything")
    args = parser.parse_args()

    settings = get_settings()
    docs_dir = settings.documents_dir
    manifest_path = docs_dir / "sources.json"
    if not manifest_path.exists():
        print(f"ERROR: manifest not found: {manifest_path}")
        return 1
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    settings.chroma_dir.mkdir(parents=True, exist_ok=True)
    retrieval = RetrievalService(settings, build_embedder(settings.embedding_backend))
    if args.rebuild:
        retrieval.client.delete_collection(settings.collection_name)
        retrieval = RetrievalService(settings, build_embedder(settings.embedding_backend))
    col, embedder = retrieval.collection, retrieval.embedder

    listed = {entry.get("file") for entry in manifest}
    for pdf in sorted(docs_dir.glob("*.pdf")):
        if pdf.name not in listed:
            print(f"SKIP  {pdf.name}: not in sources.json (unverified)")

    stats = {"indexed": 0, "unchanged": 0, "failed": 0, "chunks": 0}
    started = time.time()
    for entry in manifest:
        missing = [f for f in REQUIRED_FIELDS if not entry.get(f)]
        if missing:
            print(f"FAIL  {entry.get('file', '?')}: manifest entry missing {missing}")
            stats["failed"] += 1
            continue
        path = docs_dir / entry["file"]
        if not path.exists():
            print(f"FAIL  {entry['file']}: file not found (download it from {entry['official_url']})")
            stats["failed"] += 1
            continue

        digest = file_sha256(path)
        existing = col.get(where={"doc_id": entry["doc_id"]}, include=["metadatas"], limit=1)
        if existing["ids"] and existing["metadatas"][0].get("file_sha256") == digest:
            print(f"OK    {entry['file']}: already indexed, unchanged")
            stats["unchanged"] += 1
            continue
        if existing["ids"]:
            col.delete(where={"doc_id": entry["doc_id"]})

        try:
            pages = extract_pages(path)
        except Exception as exc:  # noqa: BLE001
            print(f"FAIL  {entry['file']}: could not open PDF ({type(exc).__name__})")
            stats["failed"] += 1
            continue
        text = clean_pages(pages)
        if len(text) < 500:
            print(f"FAIL  {entry['file']}: too little text extracted ({len(text)} chars); scanned PDF? OCR not supported yet")
            stats["failed"] += 1
            continue

        sections = split_sections(text)
        chunks = chunk_sections(sections)
        base_md = {
            "doc_id": entry["doc_id"], "title": entry["title"], "act_name": entry["act_name"],
            "short_name": entry.get("short_name", ""), "jurisdiction": entry.get("jurisdiction", "India"),
            "legal_status": entry.get("legal_status", ""), "effective_date": entry.get("effective_date", ""),
            "url": entry["official_url"], "date_checked": entry["date_checked"],
            "version": entry.get("version", ""), "file_sha256": digest,
        }
        ids, docs, mds = [], [], []
        seen = set()
        for n, ch in enumerate(chunks):
            cid = hashlib.sha256(f"{entry['doc_id']}|{ch.section}|{ch.index}|{ch.text}".encode()).hexdigest()[:32]
            if cid in seen:
                continue
            seen.add(cid)
            ids.append(cid)
            docs.append(ch.text)
            mds.append({**base_md, "section": ch.section or "", "section_title": ch.section_title or "",
                        "chunk_index": ch.index, "position": n})
        for i in range(0, len(ids), BATCH):
            col.add(ids=ids[i:i + BATCH], documents=docs[i:i + BATCH], metadatas=mds[i:i + BATCH],
                    embeddings=embedder.embed(docs[i:i + BATCH]))
        numbered = sum(1 for s in sections if s.number)
        print(f"INDEX {entry['file']}: {len(pages)} pages, {numbered} sections detected, {len(ids)} chunks")
        stats["indexed"] += 1
        stats["chunks"] += len(ids)

    print(f"\nDone in {time.time() - started:.1f}s. indexed={stats['indexed']} unchanged={stats['unchanged']} "
          f"failed={stats['failed']} new_chunks={stats['chunks']} total_chunks={col.count()}")
    return 1 if stats["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
