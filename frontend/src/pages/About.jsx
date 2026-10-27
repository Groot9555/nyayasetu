import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { api } from '../services/api.js';

export default function About() {
  const [docs, setDocs] = useState(null);
  const [health, setHealth] = useState(null);
  useEffect(() => {
    api.listSources().then((d) => setDocs(d.documents)).catch(() => setDocs([]));
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <div className="container page prose">
      <h1>About NyayaSetu</h1>
      <p>
        NyayaSetu (“bridge to justice”) is a legal-information web application that helps people in India understand
        selected legal provisions, explore general procedures, and prepare editable complaint drafts.
      </p>

      <h2 id="features">Features</h2>
      <ul>
        <li><strong>Ask NyayaSetu</strong>: questions answered from indexed legal sources, with references.</li>
        <li><strong>Legal Decoder</strong>: look up a term or section and see the retrieved provision text.</li>
        <li><strong>Rights Navigator</strong>: general information, clarifying questions, and official resources for common issues.</li>
        <li><strong>Complaint Generator</strong>: an editable draft with placeholders for missing facts, downloadable as a PDF.</li>
      </ul>

      <h2>How RAG works</h2>
      <p>
        Retrieval-Augmented Generation (RAG) means the system first <em>retrieves</em> relevant passages from a
        curated collection of legal documents, then <em>generates</em> an answer using only those passages. Each
        document is split into section-aware chunks, converted into vectors (embeddings), and stored in ChromaDB.
        Your question is embedded the same way and matched against those chunks. If no passage is similar enough,
        NyayaSetu says it could not verify an answer instead of guessing.
      </p>
      {health && (
        <p className="small muted">
          Current server mode: {health.llm_mode === 'generated' ? 'AI-generated answers grounded in retrieved passages' : 'extractive (shows retrieved passages; AI summarisation not configured)'} · {health.indexed_documents} documents, {health.indexed_chunks} passages indexed.
        </p>
      )}

      <h2>Indexed sources</h2>
      {docs === null ? <p className="muted">Loading…</p> : docs.length === 0 ? (
        <p className="muted">No documents are indexed yet (or the server is unreachable).</p>
      ) : (
        <ul>
          {docs.map((d) => (
            <li key={d.doc_id}>
              {d.act_name} {d.version && <span className="muted small">({d.version})</span>}{' '}
              {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer">official copy <ExternalLink size={12} /></a>}
              {d.date_checked && <span className="muted small"> · checked {d.date_checked}</span>}
            </li>
          ))}
        </ul>
      )}

      <h2>Limitations</h2>
      <ul>
        <li>Only a small number of acts are indexed. Many laws, rules, state amendments, and court judgments are not included.</li>
        <li>Retrieved text may be out of date if an act has been amended after the indexed version.</li>
        <li>AI-generated explanations can be wrong or incomplete. The tool has not been formally evaluated for legal accuracy.</li>
        <li>English only for now; Hindi and voice input are planned.</li>
      </ul>

      <h2>Why source verification matters</h2>
      <p>
        Laws are precise, and small differences in wording or facts can change the outcome. Always open the official
        source linked with each answer and, for decisions that matter, consult a qualified lawyer or your District
        Legal Services Authority (free legal aid may be available).
      </p>

      <h2 id="project">Project information</h2>
      <p>
        NyayaSetu is a BCA minor project (session 2026–2027). It is a student project, <strong>not an official
        government service</strong>, and has no affiliation with any government body, court, or legal institution.
      </p>
    </div>
  );
}
