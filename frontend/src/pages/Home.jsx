import { Link } from 'react-router-dom';
import { MessageSquare, BookText, Compass, FileText, Search, Database, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';

const FEATURES = [
  { to: '/ask', icon: MessageSquare, title: 'Ask NyayaSetu', text: 'Ask a legal-information question and get an answer with source references.' },
  { to: '/legal-decoder', icon: BookText, title: 'Legal Decoder', text: 'Look up a legal term or section and read the provision in context.' },
  { to: '/rights', icon: Compass, title: 'Rights Navigator', text: 'Explore general information and next steps for common issues.' },
  { to: '/complaint-generator', icon: FileText, title: 'Complaint Generator', text: 'Create an editable complaint or application draft and download it as a PDF.' },
];

const STEPS = [
  { icon: Search, title: 'You ask', text: 'Type a question in plain language.' },
  { icon: Database, title: 'We retrieve', text: 'NyayaSetu searches its index of official legal documents for relevant passages.' },
  { icon: Sparkles, title: 'We answer', text: 'An answer is built only from those passages. If nothing relevant is found, we say so.' },
  { icon: ShieldCheck, title: 'You verify', text: 'Every answer lists its sources so you can check the official text.' },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <h1>Understand Your Rights. Take the Next Step.</h1>
          <p className="hero-sub">
            NyayaSetu explains selected Indian laws in simple language, shows where each answer comes from, and helps
            you prepare a first draft of a complaint or application.
          </p>
          <div className="hero-actions">
            <Link to="/ask" className="btn btn-primary">Ask a Legal Question <ArrowRight size={16} /></Link>
            <Link to="/rights" className="btn btn-outline-light">Explore Your Rights</Link>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="grid grid-4">
          {FEATURES.map(({ to, icon: Icon, title, text }) => (
            <Link to={to} key={to} className="card card-link">
              <span className="icon-circle"><Icon size={20} /></span>
              <h3>{title}</h3>
              <p className="muted">{text}</p>
              <span className="card-cta">Open <ArrowRight size={14} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <ol className="steps">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="step">
                <span className="step-num">{i + 1}</span>
                <Icon size={22} className="teal" />
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container section">
        <h2 className="section-title">Trust &amp; Safety</h2>
        <div className="grid grid-3">
          <div className="card"><h3>Information, not advice</h3><p className="muted">NyayaSetu gives general legal information. It does not replace a qualified lawyer or an official authority.</p></div>
          <div className="card"><h3>Sources you can check</h3><p className="muted">Answers come from official legal documents the project has indexed, and list the act and section they rely on.</p></div>
          <div className="card"><h3>Privacy by default</h3><p className="muted">No account needed. Questions and complaint details are not stored after your request is processed.</p></div>
        </div>
      </section>
    </>
  );
}
