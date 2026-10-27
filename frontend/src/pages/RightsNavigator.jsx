import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ShoppingBag, ShieldAlert, Car, Gavel, Landmark, ArrowLeft, ExternalLink, HelpCircle } from 'lucide-react';
import { api } from '../services/api.js';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import FormattedText from '../components/FormattedText.jsx';
import { SourceList } from '../components/SourceCard.jsx';
import { DisclaimerBanner } from '../components/ChatMessage.jsx';

const ICONS = { consumer: ShoppingBag, cybercrime: ShieldAlert, traffic: Car, criminal: Gavel, civil: Landmark };

export default function RightsNavigator() {
  useEffect(() => api.warmup(), []);
  const { topicId } = useParams();
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [topicsError, setTopicsError] = useState('');

  const loadTopics = () => {
    setLoadingTopics(true);
    setTopicsError('');
    api.rightsTopics().then(setTopics).catch((e) => setTopicsError(e.message)).finally(() => setLoadingTopics(false));
  };
  useEffect(loadTopics, []);

  const topic = topics.find((t) => t.id === topicId);

  return (
    <div className="container page">
      {!topicId && (
        <>
          <h1>Rights Navigator</h1>
          <p className="muted">
            Choose an area to see general information, clarifying questions, related legal provisions, and possible
            next steps. These are informational categories; not every issue in an area is covered.
          </p>
        </>
      )}
      {loadingTopics && <LoadingIndicator label="Loading topics…" />}
      <ErrorMessage message={topicsError} onRetry={loadTopics} />

      {!topicId && !loadingTopics && (
        <div className="grid grid-3">
          {topics.map((t) => {
            const Icon = ICONS[t.id] || HelpCircle;
            return (
              <button key={t.id} className="card card-link text-left" onClick={() => navigate(`/rights/${t.id}`)}>
                <span className="icon-circle"><Icon size={20} /></span>
                <h3>{t.title}</h3>
                <p className="muted">{t.summary}</p>
                {t.support_level === 'limited' && <span className="pill pill-amber">Limited sources indexed</span>}
              </button>
            );
          })}
        </div>
      )}

      {topicId && !loadingTopics && !topic && !topicsError && (
        <p>Unknown topic. <Link to="/rights">Back to all topics</Link></p>
      )}
      {topic && <TopicDetail topic={topic} />}
    </div>
  );
}

function TopicDetail({ topic }) {
  const [description, setDescription] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e?.preventDefault();
    setError('');
    setLoading(true);
    setResult(null);
    try {
      setResult(await api.navigateRights(topic.id, description, jurisdiction));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Link to="/rights" className="back-link"><ArrowLeft size={16} /> All topics</Link>
      <h1>{topic.title}</h1>
      <p className="muted">{topic.description}</p>
      {topic.support_level === 'limited' && (
        <div className="alert alert-warn">NyayaSetu has limited indexed legal sources for this area, so it may not find relevant provisions.</div>
      )}
      <DisclaimerBanner />

      <div className="two-col">
        <form className="card" onSubmit={submit}>
          <h3>Clarifying questions</h3>
          <ul className="questions">{topic.clarifying_questions.map((q) => <li key={q}>{q}</li>)}</ul>
          <div className="field">
            <label htmlFor="desc">Describe your issue (general terms; avoid sensitive personal details)</label>
            <textarea id="desc" rows={5} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="jur">State / jurisdiction (optional)</label>
            <input id="jur" maxLength={100} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} placeholder="e.g. Delhi" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>Get general guidance</button>
        </form>

        <aside className="card">
          <h3>Official resources</h3>
          <ul className="resources">
            {topic.official_resources.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">{r.name} <ExternalLink size={12} /></a>
                {r.note && <span className="small muted"> — {r.note}</span>}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {loading && <LoadingIndicator label="Finding related information…" />}
      <ErrorMessage message={error} onRetry={!loading ? submit : null} />

      {result && (
        <div className="card result">
          {result.status === 'needs_more_detail' && <span className="pill pill-amber">More detail needed</span>}
          {result.status === 'insufficient_evidence' && <span className="pill pill-amber">Could not verify from sources</span>}
          <h4 className="answer-heading">General explanation</h4>
          <FormattedText text={result.explanation} />
          {result.uncertainty && (
            <>
              <h4 className="answer-heading">Uncertainty</h4>
              <p>{result.uncertainty}</p>
            </>
          )}
          <h4 className="answer-heading">Possible next steps</h4>
          <ul>{result.next_steps.map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="small muted">{result.next_steps_basis}</p>
          <SourceList sources={result.sources} title="Retrieved legal information" />
          <p className="verify-note">{result.disclaimer}</p>
        </div>
      )}
    </>
  );
}
