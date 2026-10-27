import json
import logging
import re

from ..schemas.decoder import DecoderResponse
from .llm_service import LLMUnavailableError
from .rag_service import INSUFFICIENT_TOKEN, SAFETY_RULES, RAGService, describe_passage, format_passages, validate_citations
from .retrieval_service import Passage
from .text_processing import parse_section_query

log = logging.getLogger(__name__)

DECODER_TASK = """Explain the legal term or provision "{term}" in plain language using only the passages.
Return a JSON object with keys:
  "explanation": a short plain-language explanation with inline citations like [1],
  "conditions": a list of important conditions, exceptions, or limitations stated in the passages (may be empty).
If the passages do not define or explain it, return exactly {token}."""


class LegalDecoderService:
    def __init__(self, rag: RAGService):
        self.rag = rag
        self.retrieval = rag.retrieval

    def decode(self, term: str, act: str | None) -> DecoderResponse:
        section = parse_section_query(term)
        passages: list[Passage] = []
        status = "not_found"

        if section:
            passages = self.retrieval.get_section(section, act)
            if passages:
                docs = {p.metadata["doc_id"] for p in passages}
                if len(docs) > 1 and not act:
                    names = sorted({p.metadata["act_name"] for p in passages})
                    return DecoderResponse(
                        term=term,
                        explanation=(f"Section {section} exists in more than one indexed act ({'; '.join(names)}). "
                                     "Please choose the act to see the correct provision."),
                        sources=[p.to_source(300) for p in passages if p.metadata.get("chunk_index", 0) == 0],
                        verification_status="related_passages",
                        mode="insufficient_evidence",
                    )
                status = "verified_section"
            else:
                return DecoderResponse(
                    term=term,
                    explanation=(f"Section {section} could not be verified in "
                                 f"{'the selected act' if act else 'any indexed act'}. NyayaSetu will not guess its "
                                 "contents. Check the section number and act, or consult India Code "
                                 "(https://www.indiacode.nic.in)."),
                    sources=[], verification_status="not_found", mode="insufficient_evidence",
                )
        else:
            passages = self._search_term(term, act)
            if passages:
                status = "related_passages"

        if not passages:
            return DecoderResponse(
                term=term,
                explanation=(f"NyayaSetu could not find \"{term}\" in its indexed legal sources, so it cannot "
                             "give a verified explanation. Try a different spelling, a section number, or another act."),
                sources=[], verification_status="not_found", mode="insufficient_evidence",
            )

        original = passages[0].text if status == "verified_section" else None
        if status == "verified_section":
            original = "\n".join(p.text for p in passages[:3])

        if self.rag.llm:
            try:
                task = DECODER_TASK.format(term=term.replace('"', "'"), token=INSUFFICIENT_TOKEN)
                raw = self.rag.llm.complete(SAFETY_RULES, f"{task}\n\nPassages:\n{format_passages(passages)}")
                parsed = self._parse_json(raw)
                if raw.strip().startswith(INSUFFICIENT_TOKEN) or not parsed:
                    raise ValueError("no usable answer")
                explanation, cited = validate_citations(str(parsed.get("explanation", "")), passages)
                conditions = [validate_citations(str(c), passages)[0] for c in parsed.get("conditions", [])][:8]
                return DecoderResponse(
                    term=term, original_text=original, explanation=explanation, conditions=conditions,
                    sources=[p.to_source() for p in (cited or passages)], verification_status=status, mode="generated",
                )
            except (LLMUnavailableError, ValueError):
                log.info("decoder falling back to extractive mode")

        refs = "; ".join(describe_passage(p) for p in passages[:3])
        explanation = (
            f"Plain-language summarisation is not enabled on this server. The provision text shown here was "
            f"retrieved from: {refs}. Read it carefully and open the official source."
            if status == "verified_section"
            else f"No exact section match. These indexed passages mention or relate to \"{term}\": {refs}."
        )
        return DecoderResponse(
            term=term, original_text=original, explanation=explanation, conditions=[],
            sources=[p.to_source() for p in passages], verification_status=status, mode="extractive",
        )

    def _search_term(self, term: str, act: str | None) -> list[Passage]:
        doc_ids = [act] if act else None
        semantic = self.retrieval.search(f"meaning and definition of {term}", k=5, doc_ids=doc_ids)
        # Prefer passages that literally contain the term (case-insensitive).
        pat = re.compile(re.escape(term), re.I)
        literal = [p for p in semantic if pat.search(p.text)]
        return literal or semantic

    @staticmethod
    def _parse_json(raw: str) -> dict | None:
        m = re.search(r"\{.*\}", raw, re.S)
        if not m:
            return None
        try:
            data = json.loads(m.group(0))
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None
