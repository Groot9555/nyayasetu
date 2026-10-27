from conftest import FakeLLM, make_client

from app.main import app


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["api_version"]
    assert body["indexed_chunks"] == 4
    assert "key" not in str(body).lower()


def test_empty_question_rejected(client):
    for q in ["", "   ", "a"]:
        r = client.post("/api/ask", json={"question": q})
        assert r.status_code == 422


def test_unsupported_language_rejected(client):
    assert client.post("/api/ask", json={"question": "identity theft", "language": "fr"}).status_code == 422


def test_valid_question_invokes_retrieval_and_returns_sources(client, retrieval):
    r = client.post("/api/ask", json={"question": "punishment for identity theft using someone's password"})
    assert r.status_code == 200
    body = r.json()
    assert retrieval.search_calls, "retrieval should be invoked"
    assert body["mode"] == "extractive"
    assert body["sources"] and body["sources"][0]["section"] == "66C"
    assert body["disclaimer"]


def test_unsupported_question_gets_uncertainty_not_fabrication(client):
    r = client.post("/api/ask", json={"question": "best recipe for butter chicken masala"})
    body = r.json()
    assert body["mode"] == "insufficient_evidence"
    assert body["sources"] == []
    assert "could not verify" in body["answer"].lower()


def test_generated_answer_strips_invalid_citations(llm_client):
    r = llm_client.post("/api/ask", json={"question": "identity theft password punishment"})
    body = r.json()
    assert body["mode"] == "generated"
    assert "[9]" not in body["answer"] and "[1]" in body["answer"]
    assert len(body["sources"]) == 1
    system, user = llm_client.llm.calls[0]
    assert "Never invent" in system and "<passage" in user


def test_llm_insufficient_evidence_token(retrieval):
    c = make_client(retrieval, FakeLLM("INSUFFICIENT_EVIDENCE"))
    body = c.post("/api/ask", json={"question": "identity theft password"}).json()
    app.dependency_overrides.clear()
    assert body["mode"] == "insufficient_evidence" and body["sources"] == []


def test_llm_failure_falls_back_without_leaking(retrieval):
    from app.services.llm_service import LLMUnavailableError

    class Broken:
        def complete(self, s, u):
            raise LLMUnavailableError("provider down sk-secret12345678")

    c = make_client(retrieval, Broken())
    r = c.post("/api/ask", json={"question": "identity theft password"})
    app.dependency_overrides.clear()
    assert r.status_code == 200 and r.json()["mode"] == "extractive"
    assert "sk-secret" not in r.text


def test_unhandled_error_does_not_expose_secrets(retrieval):
    class Exploding:
        def complete(self, s, u):
            raise RuntimeError("boom api_key=sk-supersecretvalue123")

    c = make_client(retrieval, Exploding())
    c_raise = c.__class__(app, raise_server_exceptions=False)
    r = c_raise.post("/api/ask", json={"question": "identity theft password"})
    app.dependency_overrides.clear()
    assert r.status_code == 500
    assert "sk-" not in r.text and "boom" not in r.text


def test_decoder_verified_section(client):
    body = client.post("/api/legal-decoder", json={"term": "Section 66C", "act": "it_act_2000"}).json()
    assert body["verification_status"] == "verified_section"
    assert "identity theft" in body["original_text"]
    assert body["sources"][0]["section"] == "66C"


def test_decoder_ambiguous_section_asks_for_act(client):
    body = client.post("/api/legal-decoder", json={"term": "Section 2"}).json()
    assert body["verification_status"] == "related_passages"
    assert "more than one" in body["explanation"]


def test_decoder_unknown_section_is_safe(client):
    body = client.post("/api/legal-decoder", json={"term": "Section 999Z"}).json()
    assert body["verification_status"] == "not_found"
    assert body["sources"] == [] and body["original_text"] is None
    assert "could not be verified" in body["explanation"]


def test_decoder_term_search(client):
    body = client.post("/api/legal-decoder", json={"term": "computer resource"}).json()
    assert body["verification_status"] == "related_passages"
    assert any(s["section"] == "2" for s in body["sources"])


def test_rights_topics_and_incomplete_description(client):
    topics = client.get("/api/rights-navigator/topics").json()
    assert {t["id"] for t in topics} >= {"consumer", "cybercrime", "traffic", "criminal", "civil"}
    body = client.post("/api/rights-navigator", json={"topic": "cybercrime", "description": "hacked"}).json()
    assert body["status"] == "needs_more_detail"
    assert body["topic"]["clarifying_questions"]
    assert body["next_steps"]


def test_rights_full_description(client):
    body = client.post("/api/rights-navigator", json={
        "topic": "traffic", "description": "I was fined for riding a motor cycle without wearing a helmet"}).json()
    assert body["status"] == "ok"
    assert any(s["section"] == "129" for s in body["sources"])


def test_rights_unknown_topic(client):
    assert client.post("/api/rights-navigator", json={"topic": "space-law"}).status_code == 404


def test_complaint_preserves_facts_and_uses_placeholders(client):
    facts = "On 3 March my online order #A123 arrived damaged and the seller refused a refund."
    body = client.post("/api/complaint-generator", json={
        "document_type": "complaint", "applicant_name": "Asha Verma", "incident_description": facts}).json()
    draft = body["draft"]
    assert facts in draft and "Asha Verma" in draft
    assert "[NAME / DESIGNATION OF THE AUTHORITY]" in draft
    assert "[DATE OF INCIDENT]" in draft
    assert "[STATE THE ACTION OR REMEDY YOU ARE REQUESTING]" in body["placeholders"]
    assert "[APPLICANT FULL NAME]" not in draft
    assert body["label"].startswith("AI-generated draft")


def test_pdf_generation(client):
    r = client.post("/api/complaint-generator/pdf",
                    json={"draft": "To,\nThe Officer\n\nSubject: Complaint — test <b>&</b>", "filename": "../../etc/passwd"})
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    cd = r.headers["content-disposition"]
    assert ".." not in cd and "/" not in cd.split("filename=")[1]


def test_pdf_invalid_input(client):
    assert client.post("/api/complaint-generator/pdf", json={"draft": ""}).status_code == 422
    assert client.post("/api/complaint-generator/pdf", json={}).status_code == 422
    assert client.post("/api/complaint-generator/pdf", json={"draft": "x" * 20001}).status_code in (413, 422)


def test_request_size_limit(client):
    r = client.post("/api/ask", content=b'{"question": "' + b"a" * 40000 + b'"}',
                    headers={"Content-Type": "application/json"})
    assert r.status_code == 413


def test_source_search(client):
    body = client.get("/api/legal-sources/search", params={"q": "protective headgear helmet"}).json()
    assert body["results"] and body["results"][0]["section"] == "129"
    assert client.get("/api/legal-sources/search", params={"q": "a"}).status_code == 422


def test_cors_only_configured_origin(client):
    ok = client.options("/api/ask", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.options("/api/ask", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers
