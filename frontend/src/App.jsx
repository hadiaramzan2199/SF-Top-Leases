import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Manage from './pages/Manage.jsx';

function viewFromPath(pathname = window.location.pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === '/manage' ? 'manage' : 'dashboard';
}

function pathForView(view) {
  return view === 'manage' ? '/manage' : '/';
}

export default function App() {
  const [view, setViewState] = useState(() => (
    typeof window !== 'undefined' ? viewFromPath() : 'dashboard'
  ));

  useEffect(() => {
    const sync = () => setViewState(viewFromPath());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  function setView(next) {
    const target = next === 'manage' ? 'manage' : 'dashboard';
    setViewState(target);
    const nextPath = pathForView(target);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
  }

  return (
    <div className="app-shell">
      <Header view={view} setView={setView} />
      <main className="app-main">
        {view === 'dashboard' ? <Dashboard /> : <Manage />}
      </main>
    </div>
  );
}
