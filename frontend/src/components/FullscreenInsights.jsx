import { useState } from 'react';
import StatsPanel from './StatsPanel.jsx';
import Timeline from './Timeline.jsx';

export default function FullscreenInsights({ leases, activeLeaseId, onSelectLease }) {
  const [tab, setTab] = useState('stats');

  return (
    <aside className="fullscreen-insights" aria-label="Market insights">
      <div className="fullscreen-insights-tabs">
        <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>Market stats</button>
        <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>Timeline</button>
      </div>
      <div className="fullscreen-insights-body">
        {tab === 'stats' ? (
          <StatsPanel leases={leases} variant="fullscreen" />
        ) : (
          <Timeline
            leases={leases}
            activeLeaseId={activeLeaseId}
            onSelectLease={onSelectLease}
            variant="fullscreen"
          />
        )}
      </div>
    </aside>
  );
}
