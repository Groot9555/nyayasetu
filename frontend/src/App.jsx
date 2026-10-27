import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Ask from './pages/Ask.jsx';
import LegalDecoder from './pages/LegalDecoder.jsx';
import RightsNavigator from './pages/RightsNavigator.jsx';
import ComplaintGenerator from './pages/ComplaintGenerator.jsx';
import About from './pages/About.jsx';
import { Privacy, Disclaimer } from './pages/Policies.jsx';
import NotFound from './pages/NotFound.jsx';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  return (
    <div className="app">
      <ScrollToTop />
      <Navbar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/legal-decoder" element={<LegalDecoder />} />
          <Route path="/rights" element={<RightsNavigator />} />
          <Route path="/rights/:topicId" element={<RightsNavigator />} />
          <Route path="/complaint-generator" element={<ComplaintGenerator />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
