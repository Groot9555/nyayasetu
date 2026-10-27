import { useState } from 'react';
import { BookOpen, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

export default function SourceCard({ source, index }) {
  const [open, setOpen] = useState(false);
  const ref = source.section ? `Section ${source.section}` : 'Section not identified';
  return (
    <div className="source-card">
      <div className="source-head">
        <BookOpen size={16} className="teal" />
        <div className="source-meta">
          <div className="source-title">
            {index != null && <span className="badge">[{index}]</span>} {source.act_name || source.title}
          </div>
          <div className="small muted">
            {ref}
            {source.section_title ? ` — ${source.section_title}` : ''}
            {source.relevance != null && source.relevance < 1 && <> · match {Math.round(source.relevance * 100)}%</>}
          </div>
        </div>
      </div>
      <div className="source-actions">
        {source.excerpt && (
          <button className="link-btn small" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? 'Hide' : 'Show'} retrieved text
          </button>
        )}
        {source.url && (
          <a className="small source-link" href={source.url} target="_blank" rel="noopener noreferrer">
            Official source <ExternalLink size={12} />
          </a>
        )}
      </div>
      {open && source.excerpt && <blockquote className="excerpt">{source.excerpt}</blockquote>}
    </div>
  );
}

export function SourceList({ sources, title = 'Sources' }) {
  if (!sources?.length) return null;
  return (
    <div className="sources">
      <div className="sources-title">{title}</div>
      {sources.map((s, i) => (
        <SourceCard key={`${s.doc_id}-${s.section}-${i}`} source={s} index={i + 1} />
      ))}
    </div>
  );
}
