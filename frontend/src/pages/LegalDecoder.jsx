import { useEffect, useState } from 'react';
import { Search, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { api } from '../services/api.js';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import FormattedText from '../components/FormattedText.jsx';
import { SourceList } from '../components/SourceCard.jsx';
import { DisclaimerBanner } from '../components/ChatMessage.jsx';

const STATUS = {
  verified_section: { icon: CheckCircle2, text: 'Section found in indexed source', cls: 'pill-teal' },
  related_passages: { icon: HelpCircle, text: 'Related passages found (no exact section match)', cls: 'pill-navy' },
  not_found: { icon: AlertCircle, text: 'Could not verify', cls: 'pill-amber' },
};

export default function LegalDecoder() {
  useEffect(() => api.warmup(), []);
  const [term, setTerm] = useState('');
  const [act, setAct] = useState('');
  const [acts, setActs] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listSources().then((d) => setActs(d.documents)).catch(() => setActs([]));
  }, []);

  async function explain(e) {
    e?.preventDefault();
    if (!term.trim()) {
      setError('Enter a legal term (e.g. "electronic record") or a section (e.g. "Section 66C").');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      setResult(await api.decode(term.trim(), act));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const status = result && STATUS[result.verification_status];

  return (
    <div className="container page">
      <h1>Legal Decoder</h1>
      <p className="muted">Enter a legal term or a section number to see the provision and a plain-language explanation.</p>
      <DisclaimerBanner />

      <form className="card form-row" onSubmit={explain}>
        <div className="field grow">
          <label htmlFor="term">Term or section</label>
          <div className="input-icon">
            <Search size={16} />
            <input id="term" maxLength={300} value={term} onChange={(e) => setTerm(e.target.value)}
                   placeholder='e.g. "Section 66C" or "electronic record"' />
          </div>
        </div>
        <div className="field">
          <label htmlFor="act">Act (optional)</label>
          <select id="act" value={act} onChange={(e) => setAct(e.target.value)}>
            <option value="">All indexed acts</option>
            {acts.map((a) => <option key={a.doc_id} value={a.doc_id}>{a.act_name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary align-end" type="submit" disabled={loading}>Explain</button>
      </form>

      {loading && <LoadingIndicator label="Looking up indexed sources…" />}
      <ErrorMessage message={error} onRetry={term.trim() && !loading ? explain : null} />

      {result && (
        <div className="card result">
          <div className="result-head">
            <h2>{result.term}</h2>
            {status && <span className={`pill ${status.cls}`}><status.icon size={14} /> {status.text}</span>}
          </div>
          {result.original_text && (
            <>
              <h4 className="answer-heading">Original provision (retrieved text)</h4>
              <blockquote className="excerpt long">{result.original_text}</blockquote>
            </>
          )}
          <h4 className="answer-heading">Plain-language explanation</h4>
          <FormattedText text={result.explanation} />
          {result.conditions?.length > 0 && (
            <>
              <h4 className="answer-heading">Important conditions or limitations</h4>
              <ul>{result.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </>
          )}
          <SourceList sources={result.sources} title="Source document" />
          <p className="verify-note">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
