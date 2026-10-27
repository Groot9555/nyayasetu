import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <strong>NyayaSetu</strong>
          <p className="muted small">
            A BCA minor project (2026–27). General legal information only, not legal advice and not an official
            government service.
          </p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/about">About</Link>
          <Link to="/about#features">Features</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/disclaimer">Disclaimer</Link>
          <Link to="/about#project">Contact / Project</Link>
        </nav>
      </div>
    </footer>
  );
}
