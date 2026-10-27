import { useState } from 'react';
import { Copy, Download, RotateCcw, FileText, Check } from 'lucide-react';
import { api } from '../services/api.js';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import { SourceList } from '../components/SourceCard.jsx';

const EMPTY = {
  document_type: 'complaint',
  applicant_name: '',
  applicant_contact: '',
  recipient: '',
  issue_category: '',
  incident_date: '',
  incident_description: '',
  requested_action: '',
  optional_details: '',
};

const CATEGORIES = ['Consumer issue', 'Cybercrime / online fraud', 'Traffic / transport', 'Police matter', 'Civil dispute', 'Public service / government department', 'Other'];

export default function ComplaintGenerator() {
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function generate(e) {
    e?.preventDefault();
    if (form.incident_description.trim().length < 10) {
      setError('Please describe the issue (at least 10 characters).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || (k === 'incident_description' ? '' : null)]));
      payload.document_type = form.document_type;
      const res = await api.generateComplaint(payload);
      setResult(res);
      setDraft(res.draft);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy automatically. Select the text and copy it manually.');
    }
  }

  async function downloadPdf() {
    setPdfLoading(true);
    setError('');
    try {
      const blob = await api.complaintPdf(draft, null, `nyayasetu-${form.document_type}-draft`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nyayasetu-${form.document_type}-draft.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setPdfLoading(false);
    }
  }

  function reset() {
    setForm(EMPTY);
    setResult(null);
    setDraft('');
    setError('');
  }

  const remaining = result ? result.placeholders.filter((p) => draft.includes(p)) : [];

  return (
    <div className="container page">
      <h1>Complaint Generator</h1>
      <p className="muted">
        Fill in what you know. Anything left blank becomes a <code>[PLACEHOLDER]</code> in the draft. NyayaSetu
        never submits anything on your behalf.
      </p>

      {!result && (
        <form className="card form-grid" onSubmit={generate}>
          <div className="field">
            <label htmlFor="type">Document type</label>
            <select id="type" value={form.document_type} onChange={set('document_type')}>
              <option value="complaint">Complaint</option>
              <option value="application">Application</option>
              <option value="grievance_letter">Grievance letter</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="cat">Issue category</label>
            <select id="cat" value={form.issue_category} onChange={set('issue_category')}>
              <option value="">Select…</option>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="name">Applicant name</label>
            <input id="name" maxLength={120} value={form.applicant_name} onChange={set('applicant_name')} />
          </div>
          <div className="field">
            <label htmlFor="contact">Applicant address / contact (optional)</label>
            <input id="contact" maxLength={300} value={form.applicant_contact} onChange={set('applicant_contact')} />
          </div>
          <div className="field">
            <label htmlFor="recipient">Recipient / authority (if known)</label>
            <input id="recipient" maxLength={200} value={form.recipient} onChange={set('recipient')} placeholder="e.g. The Station House Officer, … Police Station" />
          </div>
          <div className="field">
            <label htmlFor="date">Incident date (if relevant)</label>
            <input id="date" type="date" value={form.incident_date} onChange={set('incident_date')} />
          </div>
          <div className="field span-2">
            <label htmlFor="desc">Incident description *</label>
            <textarea id="desc" rows={5} maxLength={5000} value={form.incident_description} onChange={set('incident_description')} placeholder="What happened, in order, with dates and amounts if any." />
          </div>
          <div className="field span-2">
            <label htmlFor="action">Requested action</label>
            <textarea id="action" rows={2} maxLength={1500} value={form.requested_action} onChange={set('requested_action')} placeholder="e.g. refund of ₹…, investigation, replacement" />
          </div>
          <div className="field span-2">
            <label htmlFor="extra">Optional details</label>
            <textarea id="extra" rows={2} maxLength={2000} value={form.optional_details} onChange={set('optional_details')} placeholder="Order numbers, reference numbers, previous complaints…" />
          </div>
          <div className="span-2 actions">
            <button className="btn btn-primary" type="submit" disabled={loading}><FileText size={16} /> Generate Draft</button>
          </div>
        </form>
      )}

      {loading && <LoadingIndicator label="Preparing draft…" />}
      <ErrorMessage message={error} />

      {result && (
        <div className="card result">
          <div className="alert alert-warn"><strong>{result.label}</strong></div>
          {remaining.length > 0 && (
            <p className="small">
              <strong>Fill these placeholders before use:</strong> {remaining.join(', ')}
            </p>
          )}
          <label htmlFor="draft" className="answer-heading">Editable preview</label>
          <textarea id="draft" className="draft" rows={24} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="actions">
            <button className="btn btn-primary" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy Draft'}</button>
            <button className="btn btn-secondary" onClick={downloadPdf} disabled={pdfLoading || !draft.trim()}><Download size={16} /> {pdfLoading ? 'Preparing…' : 'Download PDF'}</button>
            <button className="btn btn-ghost" onClick={reset}><RotateCcw size={16} /> Start Again</button>
          </div>
          <SourceList sources={result.sources} title="Possibly relevant legal sources (not inserted into the draft — verify before citing)" />
          <p className="verify-note">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
