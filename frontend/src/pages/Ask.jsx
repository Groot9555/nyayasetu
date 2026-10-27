import { useEffect, useRef, useState } from 'react';
import { Send, Trash2 } from 'lucide-react';
import { api } from '../services/api.js';
import ChatMessage, { DisclaimerBanner } from '../components/ChatMessage.jsx';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';

const SUGGESTIONS = [
  'What is the punishment for identity theft using someone else\u2019s password?',
  'Is wearing a helmet compulsory while riding a two-wheeler?',
  'What is the penalty for driving without a licence?',
  'What does "computer resource" mean under the IT Act?',
];

export default function Ask() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const endRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [messages, loading]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(question, { retry = false } = {}) {
    const q = question.trim();
    if (q.length < 3) {
      setError('Please enter a question (at least 3 characters).');
      return;
    }
    setError('');
    setLastQuestion(q);
    if (!retry) setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);
    abortRef.current = new AbortController();
    try {
      const res = await api.ask(q, 'en', abortRef.current.signal);
      setMessages((m) => [...m, { role: 'bot', content: res.answer, sources: res.sources, mode: res.mode, disclaimer: res.disclaimer }]);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading) send(input);
    }
  }

  function clear() {
    abortRef.current?.abort();
    setMessages([]);
    setError('');
    setLoading(false);
  }

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Ask NyayaSetu</h1>
          <p className="muted">Ask a legal-information question in English. Hindi support is planned.</p>
        </div>
        <button className="btn btn-ghost" onClick={clear} disabled={!messages.length && !error}>
          <Trash2 size={16} /> Clear conversation
        </button>
      </div>
      <DisclaimerBanner />

      <div className="chat">
        <div className="chat-messages" aria-live="polite">
          {!messages.length && !loading && (
            <div className="chat-empty">
              <p className="muted">Try one of these questions:</p>
              <div className="chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => <ChatMessage key={i} message={m} />)}
          {loading && <LoadingIndicator label="Searching legal sources…" />}
          <ErrorMessage message={error} onRetry={lastQuestion && !loading ? () => send(lastQuestion, { retry: true }) : null} />
          <div ref={endRef} />
        </div>

        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <label htmlFor="question" className="sr-only">Your question</label>
          <textarea
            id="question"
            rows={2}
            maxLength={2000}
            placeholder="Describe your question… (Enter to send, Shift+Enter for a new line)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="chat-input-side">
            <select aria-label="Language" defaultValue="en" className="lang-select">
              <option value="en">English</option>
              <option value="hi" disabled>Hindi (coming soon)</option>
            </select>
            <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>
              <Send size={16} /> Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
