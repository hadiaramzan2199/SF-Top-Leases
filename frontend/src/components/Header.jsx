import { useEffect, useState } from 'react';
import {
  HiOutlineBars3,
  HiOutlineChartBarSquare,
  HiOutlineXMark,
} from 'react-icons/hi2';

export default function Header({ view, setView }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [view]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => event.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  function go(next) {
    setView(next);
    setMenuOpen(false);
  }

  return (
    <header className="topbar">
      <button className="brand fieldset-brand" onClick={() => go('dashboard')} aria-label="Open market dashboard">
        <span className="brand-wordmark">B3</span>
      </button>

      <nav className="topnav desktop-nav" aria-label="Primary navigation">
        <button className={view === 'dashboard' ? 'active' : ''} onClick={() => go('dashboard')}>
          <HiOutlineChartBarSquare /> Market
        </button>
      </nav>

      <div className="mobile-nav">
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <HiOutlineXMark /> : <HiOutlineBars3 />}
        </button>
      </div>

      {menuOpen && (
        <>
          <button type="button" className="mobile-nav-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
          <div className="mobile-nav-sheet" role="dialog" aria-label="Navigation">
            <button className={view === 'dashboard' ? 'active' : ''} onClick={() => go('dashboard')}>
              <HiOutlineChartBarSquare />
              <span>
                <strong>Market</strong>
                <small>Map, comps, and insights</small>
              </span>
            </button>
          </div>
        </>
      )}
    </header>
  );
}
