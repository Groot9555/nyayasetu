import { User, Scale, ShieldCheck, Info } from 'lucide-react';
import FormattedText from './FormattedText.jsx';
import { SourceList } from './SourceCard.jsx';

const MODE_LABEL = {
  generated: { text: 'AI answer grounded in retrieved sources', cls: 'pill-teal' },
  extractive: { text: 'Retrieved passages (AI summarisation off)', cls: 'pill-navy' },
  insufficient_evidence: { text: 'Could not verify from sources', cls: 'pill-amber' },
};

export default function ChatMessage({ message }) {
  if (message.role === 'user') {
    return (
      <div className="msg msg-user">
        <div className="msg-avatar"><User size={16} /></div>
        <div className="msg-bubble">{message.content}</div>
      </div>
    );
  }
  const mode = MODE_LABEL[message.mode];
  return (
    <div className="msg msg-bot">
      <div className="msg-avatar bot"><Scale size={16} /></div>
      <div className="msg-bubble">
        {mode && <span className={`pill ${mode.cls}`}>{mode.text}</span>}
        <FormattedText text={message.content} />
        <SourceList sources={message.sources} title="Source references" />
        {message.disclaimer && (
          <p className="verify-note"><ShieldCheck size={14} /> {message.disclaimer}</p>
        )}
      </div>
    </div>
  );
}

export function DisclaimerBanner({ children }) {
  return (
    <div className="alert alert-info">
      <Info size={18} />
      <span>{children || 'General legal information, not legal advice. Always verify with official sources.'}</span>
    </div>
  );
}
