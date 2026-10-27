from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from ..config import Settings, get_settings
from ..schemas.ask import AskRequest, AskResponse
from ..schemas.common import HealthResponse
from ..schemas.complaint import ComplaintRequest, ComplaintResponse, PdfRequest
from ..schemas.decoder import DecoderRequest, DecoderResponse
from ..schemas.rights import RightsRequest, RightsResponse, RightsTopic
from ..schemas.sources import DocumentListResponse, IndexedDocument, SourceSearchResponse
from ..services import container
from ..services.complaint_service import ComplaintService
from ..services.legal_decoder_service import LegalDecoderService
from ..services.pdf_service import render_pdf, safe_filename
from ..services.rag_service import RAGService
from ..services.retrieval_service import RetrievalService
from ..services.rights_service import RightsService

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
def health(settings: Settings = Depends(get_settings),
           retrieval: RetrievalService = Depends(container.get_retrieval),
           rag: RAGService = Depends(container.get_rag)):
    return HealthResponse(
        status="ok", api_version=settings.api_version, llm_mode=rag.mode,
        indexed_chunks=retrieval.count(), indexed_documents=len(retrieval.list_documents()),
    )


@router.post("/ask", response_model=AskResponse)
def ask(req: AskRequest, rag: RAGService = Depends(container.get_rag)):
    return rag.ask(req.question)


@router.post("/legal-decoder", response_model=DecoderResponse)
def legal_decoder(req: DecoderRequest, decoder: LegalDecoderService = Depends(container.get_decoder)):
    return decoder.decode(req.term, req.act or None)


@router.get("/rights-navigator/topics", response_model=list[RightsTopic])
def rights_topics(rights: RightsService = Depends(container.get_rights)):
    return rights.topics()


@router.post("/rights-navigator", response_model=RightsResponse)
def rights_navigator(req: RightsRequest, rights: RightsService = Depends(container.get_rights)):
    result = rights.navigate(req.topic, req.description, req.jurisdiction)
    if result is None:
        raise HTTPException(status_code=404, detail="Unknown topic.")
    return result


@router.post("/complaint-generator", response_model=ComplaintResponse)
def complaint_generator(req: ComplaintRequest, complaints: ComplaintService = Depends(container.get_complaints)):
    return complaints.generate(req)


@router.post("/complaint-generator/pdf")
def complaint_pdf(req: PdfRequest):
    if not req.draft.strip():
        raise HTTPException(status_code=422, detail="Draft is empty.")
    pdf = render_pdf(req.draft, req.title)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{safe_filename(req.filename)}"'})


@router.get("/legal-sources/search", response_model=SourceSearchResponse)
def search_sources(q: str = Query(..., min_length=2, max_length=200), limit: int = Query(8, ge=1, le=20),
                   act: str | None = Query(None, max_length=100),
                   retrieval: RetrievalService = Depends(container.get_retrieval)):
    passages = retrieval.search(q.strip(), k=limit, doc_ids=[act] if act else None)
    return SourceSearchResponse(query=q, results=[p.to_source(400) for p in passages])


@router.get("/legal-sources", response_model=DocumentListResponse)
def list_sources(retrieval: RetrievalService = Depends(container.get_retrieval)):
    return DocumentListResponse(documents=[IndexedDocument(**d) for d in retrieval.list_documents()])
