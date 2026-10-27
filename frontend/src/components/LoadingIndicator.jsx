import { useEffect, useState } from 'react';
import { subscribeEngine } from '../services/api.js';

export default function LoadingIndicator({ label = 'Working…' }) {
  const [engine, setEngine] = useState(null);
  useEffect(() => subscribeEngine(setEngine), []);
  let text = label;
  if (engine?.phase === 'loading') {
    const pct = Math.min(99, Math.round((engine.loaded / engine.total) * 100));
    text = `Downloading the legal search engine (first time only, about 45 MB): ${pct}%`;
  }
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="dot" /><span className="dot" /><span className="dot" />
      <span className="loading-label">{text}</span>
    </div>
  );
}
