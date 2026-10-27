import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, X, Scale } from 'lucide-react';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/ask', label: 'Ask NyayaSetu' },
  { to: '/legal-decoder', label: 'Legal Decoder' },
  { to: '/rights', label: 'Rights Navigator' },
  { to: '/complaint-generator', label: 'Complaint Generator' },
  { to: '/about', label: 'About' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark"><Scale size={20} /></span>
          <span>Nyaya<span className="brand-accent">Setu</span></span>
        </Link>
        <button
          className="nav-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={`nav-links ${open ? 'open' : ''}`} aria-label="Main navigation">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
