---
title: NyayaSetu
emoji: ⚖️
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
short_description: Source-grounded Indian legal-information guidance (RAG)
---

# NyayaSetu

AI-powered legal-information and civilian-rights guidance web app (BCA minor project, 2026–27).
NyayaSetu answers questions from a curated index of official Indian legal documents using Retrieval-Augmented
Generation (RAG), shows the act and section behind each answer, and generates editable complaint drafts.

> General legal information only — not legal advice and not an official government service.

## Architecture

```
frontend/  React 18 + Vite + React Router + lucide-react
  src/services/api.js         single API client (configurable base URL)
  src/pages/                  Home, Ask, LegalDecoder, RightsNavigator, ComplaintGenerator, About, Policies
  src/components/             Navbar, Footer, SourceCard, ChatMessage, LoadingIndicator, ErrorMessage, FormattedText
backend/   FastAPI + Pydantic + ChromaDB + PyMuPDF + ReportLab
  app/api/routes.py           HTTP endpoints
  app/services/               retrieval_service, rag_service, llm_service, legal_decoder_service,
                              rights_service, complaint_service, pdf_service, text_processing, embeddings
  app/core/                   security (body-size limit, rate limit, redaction), logging_config
  scripts/ingest_documents.py ingestion (kept separate from the public API)
  data/documents/             official PDFs + sources.json (verified metadata manifest)
  tests/                      pytest suite (mocked LLM, offline embeddings)
```

**RAG flow** — question → validation → embedding (local all-MiniLM-L6-v2 via ChromaDB ONNX) → ChromaDB cosine
search → relevance filter (distance threshold + keyword overlap) → grounded prompt with numbered passages →
LLM → citation validation (citations to non-existent passages are stripped) → answer + sources + disclaimer.
If no passage passes the relevance filter, the API returns an "insufficient evidence" response instead of guessing.

### Answer modes

| `LLM_PROVIDER` | Behaviour |
|---|---|
| `none` (default) | **Extractive mode**: no generated text. Returns the retrieved provisions with references. |
| `openai` + `LLM_API_KEY` | Generated plain-language answers grounded in retrieved passages. Works with any OpenAI-compatible Chat Completions API (set `LLM_BASE_URL`, `LLM_MODEL`). Falls back to extractive mode if the provider fails. |

## Setup

Prerequisites: Python 3.11+, Node.js 18+.

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                     # optionally set LLM_PROVIDER / LLM_API_KEY
python scripts/ingest_documents.py                       # first run downloads the ~80 MB embedding model
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_BASE_URL empty = use Vite proxy to http://localhost:8000
npm run dev                 # http://localhost:5173
```

### Tests

```bash
cd backend && python -m pytest -q        # uses a mocked LLM and offline hash embeddings
cd frontend && npm run lint && npm run build
```

## Deployment (single container)

The root `Dockerfile` builds the frontend, installs the backend, and builds the ChromaDB index at image build time.
FastAPI serves the built frontend (`STATIC_DIR`) and the API from the same origin, so no CORS setup is needed.

```bash
docker build -t nyayasetu .
docker run -p 7860:7860 nyayasetu            # http://localhost:7860
docker run -p 7860:7860 -e LLM_PROVIDER=openai -e LLM_API_KEY=... nyayasetu   # generated answers
```

One-click deploy on Render's free tier (uses `render.yaml`; the repo must be public or connected to Render):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Groot9555/nyayasetu)

It also runs as a Hugging Face Docker Space (PRO required for Docker Spaces) (the YAML header at the top of this file is the Space config);
set `LLM_API_KEY` as a Space secret to enable generated answers.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Status, API version, answer mode, index size |
| POST | `/api/ask` | `{question, language}` → `{answer, sources[], disclaimer, mode}` |
| POST | `/api/legal-decoder` | `{term, act?, language}` → provision text, explanation, conditions, `verification_status` |
| GET | `/api/rights-navigator/topics` | Topic list with clarifying questions and official resources |
| POST | `/api/rights-navigator` | `{topic, description, jurisdiction?}` → explanation, next steps, sources, uncertainty |
| POST | `/api/complaint-generator` | Form fields → editable draft, placeholders, possibly relevant sources |
| POST | `/api/complaint-generator/pdf` | `{draft, title?, filename?}` → PDF download (safe filename) |
| GET | `/api/legal-sources/search?q=` | Search the index |
| GET | `/api/legal-sources` | List indexed documents with official URLs |

## Adding legal documents

1. Download the official PDF (prefer https://www.indiacode.nic.in) into `backend/data/documents/`.
2. Add an entry to `backend/data/documents/sources.json` (`file`, `doc_id`, `title`, `act_name`, `official_url`,
   `date_checked`, plus optional `legal_status`, `effective_date`, `version`). PDFs not listed are skipped as unverified.
3. Run `python scripts/ingest_documents.py`. Unchanged files are skipped (SHA-256); changed files are re-indexed.
   Use `--rebuild` to rebuild the whole collection.
4. If you add an act used by a Rights Navigator topic (`doc_ids` in `app/services/rights_service.py`, e.g.
   `consumer_protection_act_2019`, `bns_2023`), that topic switches from "limited" to "indexed" automatically.

## Implemented features

- All six routes plus Privacy and Disclaimer pages; responsive layout with mobile menu.
- Ask NyayaSetu chat: suggested questions, multiline input, clear, loading, error + retry, source cards, mode badge.
- Legal Decoder: exact section lookup (per act), term search, ambiguity handling, safe "could not verify" responses.
- Rights Navigator: 5 topic areas, clarifying questions, incomplete-description handling, retrieved provisions,
  curated general next steps (labelled as such), official government portals.
- Complaint Generator: deterministic template, user facts inserted verbatim, placeholders for missing details,
  editable preview, copy, PDF download, start again; never submits anything.
- Ingestion: PyMuPDF extraction, header/footer + amendment-footnote removal, section-aware overlapping chunks,
  metadata, de-duplication, statistics, scanned-PDF detection.
- Security: Pydantic validation, request-size limit, per-IP rate limit, CORS restricted to `FRONTEND_ORIGIN`,
  generic error responses, secret redaction in logs, prompt-injection-resistant prompt structure, keys server-side only.
- No accounts, no stored conversations or complaint details.

## Known limitations / planned

- **Indexed corpus is small**: currently the Information Technology Act, 2000 and Motor Vehicles Act, 1988 (India Code
  copies). Consumer Protection Act 2019 and BNS/BNSS 2023 are planned but were not downloaded (India Code timed out);
  the Consumer and Criminal-law topics therefore show "Limited sources indexed".
- Indexed texts may predate later amendments or state notifications; struck-down provisions (e.g. IT Act s.66A)
  still appear in the official text.
- Relevance filtering is similarity-based and can miss relevant passages or include loosely related ones.
- Without an LLM key the app runs in extractive mode (no plain-language rewriting).
- English only; Hindi, voice input, OCR for scanned PDFs, feedback endpoint, admin dashboard, and
  PostgreSQL/pgvector are planned. Rate limiting is in-memory (single process).
- Legal accuracy has not been formally evaluated; retrieval relevance and citations should be manually reviewed.
