import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money, pct, sfCompact } from '../lib/format.js';

const COLORS = {
  ink: '#0F172A',
  gold: '#E8C547',
  mint: '#10B981',
  amber: '#D97706',
  rose: '#F43F5E',
  slate: '#94A3B8',
  grid: '#E2E8F0',
  tick: '#94A3B8',
};

const PIE = [COLORS.gold, COLORS.mint, COLORS.ink, COLORS.amber, COLORS.rose, COLORS.slate];

function mid(low, high) {
  const a = Number(low);
  const b = Number(high);
  if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
  if (Number.isFinite(a)) return a;
  if (Number.isFinite(b)) return b;
  return null;
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="stats-tooltip">
      {label && <strong>{label}</strong>}
      {payload.map((entry) => (
        <span key={entry.dataKey || entry.name}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </span>
      ))}
    </div>
  );
}

function buildInsights(transactions) {
  const closed = transactions.filter((tx) => tx.status === 'closed');
  const onMarket = transactions.filter((tx) => tx.status !== 'closed');

  const closedVolume = closed.reduce((sum, tx) => sum + (mid(tx.price_low, tx.price_high) || 0), 0);
  const pipelineValue = onMarket.reduce((sum, tx) => sum + (mid(tx.price_low, tx.price_high) || 0), 0);
  const closedSf = closed.reduce((sum, tx) => sum + (Number(tx.sf) || 0), 0);

  const psfVals = transactions
    .map((tx) => mid(tx.psf_low, tx.psf_high))
    .filter((v) => Number.isFinite(v));
  const avgPsf = psfVals.length
    ? psfVals.reduce((sum, v) => sum + v, 0) / psfVals.length
    : null;

  const caps = transactions
    .map((tx) => mid(tx.cap_low, tx.cap_high))
    .filter((v) => Number.isFinite(v));
  const avgCap = caps.length
    ? caps.reduce((sum, v) => sum + v, 0) / caps.length
    : null;

  const leased = onMarket
    .map((tx) => Number(tx.pct_leased))
    .filter((v) => Number.isFinite(v));
  const avgLeased = leased.length
    ? leased.reduce((sum, v) => sum + v, 0) / leased.length
    : null;

  const statusMix = [
    { name: 'Closed', value: closed.length },
    { name: 'On market', value: onMarket.length },
  ].filter((row) => row.value > 0);

  const buckets = new Map();
  for (const tx of transactions) {
    if (!tx.as_of_date) continue;
    const key = tx.as_of_date.slice(0, 7);
    const current = buckets.get(key) || { month: key, volume: 0, deals: 0 };
    current.volume += mid(tx.price_low, tx.price_high) || 0;
    current.deals += 1;
    buckets.set(key, current);
  }
  const trend = [...buckets.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-8)
    .map((row) => ({
      label: new Date(`${row.month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      volumeM: Math.round((row.volume / 1e6) * 10) / 10,
      deals: row.deals,
    }));

  const buyerCounts = new Map();
  for (const tx of closed) {
    const name = (tx.buyer || '').trim() || 'Undisclosed';
    buyerCounts.set(name, (buyerCounts.get(name) || 0) + 1);
  }
  const topBuyers = [...buyerCounts.entries()]
    .map(([name, deals]) => ({ name, deals }))
    .sort((a, b) => b.deals - a.deals)
    .slice(0, 5);

  const priceBands = (() => {
    const prices = transactions
      .map((tx) => mid(tx.price_low, tx.price_high))
      .filter((v) => Number.isFinite(v) && v > 0);
    if (!prices.length) return [];
    const edges = [0, 25e6, 50e6, 100e6, 200e6, Infinity];
    const labels = ['<$25M', '$25–50M', '$50–100M', '$100–200M', '$200M+'];
    return labels.map((label, index) => ({
      label,
      deals: prices.filter((v) => v >= edges[index] && v < edges[index + 1]).length,
    }));
  })();

  return {
    closedCount: closed.length,
    onMarketCount: onMarket.length,
    closedVolume,
    pipelineValue,
    closedSf,
    avgPsf,
    avgCap,
    avgLeased,
    statusMix,
    trend,
    topBuyers,
    priceBands,
  };
}

export default function SalesInsights({ transactions }) {
  const data = useMemo(() => buildInsights(transactions), [transactions]);

  if (!transactions.length) return null;

  return (
    <section className="sales-insights" aria-label="Sales decision metrics">
      <div className="sales-insights-head">
        <div>
          <span className="eyebrow">Owner view</span>
          <h2>Sales intelligence</h2>
        </div>
        <p>Pipeline, closed volume, pricing, and buyer activity for ownership decisions.</p>
      </div>

      <div className="sales-kpi-strip">
        <div>
          <small>Closed volume</small>
          <strong>{money(data.closedVolume)}</strong>
          <em>{data.closedCount} closed · {sfCompact(data.closedSf)}</em>
        </div>
        <div>
          <small>On-market pipeline</small>
          <strong>{money(data.pipelineValue)}</strong>
          <em>{data.onMarketCount} listings</em>
        </div>
        <div>
          <small>Avg sale $/SF</small>
          <strong>{data.avgPsf != null ? `$${Math.round(data.avgPsf).toLocaleString()}` : '—'}</strong>
          <em>Mid of quoted range</em>
        </div>
        <div>
          <small>Avg cap rate</small>
          <strong>{data.avgCap != null ? pct(Math.round(data.avgCap * 10) / 10) : '—'}</strong>
          <em>Quoted mid · {data.avgLeased != null ? `${Math.round(data.avgLeased)}% leased on market` : 'occupancy n/a'}</em>
        </div>
      </div>

      <div className="sales-charts">
        <article className="sales-chart-card">
          <header>
            <strong>Deal flow</strong>
            <span>Volume by month ($M mid-price)</span>
          </header>
          <div className="sales-chart-body">
            {data.trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesVolFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={COLORS.grid} strokeDasharray="3 6" />
                  <XAxis dataKey="label" tick={{ fill: COLORS.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: COLORS.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `$${v}M`} />
                  <Tooltip content={<ChartTip />} />
                  <Area
                    type="monotone"
                    dataKey="volumeM"
                    name="Volume ($M)"
                    stroke={COLORS.ink}
                    strokeWidth={2}
                    fill="url(#salesVolFill)"
                    dot={{ r: 3, fill: COLORS.gold, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="sales-chart-empty">Add as-of dates to see monthly flow.</p>
            )}
          </div>
        </article>

        <article className="sales-chart-card">
          <header>
            <strong>Pipeline mix</strong>
            <span>Closed vs on market</span>
          </header>
          <div className="sales-pie-layout">
            <div className="sales-chart-body pie">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.statusMix} dataKey="value" nameKey="name" innerRadius={36} outerRadius={54} paddingAngle={3} stroke="#fff" strokeWidth={2}>
                    {data.statusMix.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE[index % PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="sales-legend">
              {data.statusMix.map((row, index) => (
                <li key={row.name}>
                  <i style={{ background: PIE[index % PIE.length] }} />
                  <span>{row.name}</span>
                  <strong>{row.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="sales-chart-card">
          <header>
            <strong>Price bands</strong>
            <span>Deal count by mid asking / sale price</span>
          </header>
          <div className="sales-chart-body">
            {data.priceBands.some((row) => row.deals > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.priceBands} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={COLORS.grid} strokeDasharray="3 6" />
                  <XAxis dataKey="label" tick={{ fill: COLORS.tick, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} height={28} />
                  <YAxis allowDecimals={false} tick={{ fill: COLORS.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="deals" name="Deals" fill={COLORS.gold} radius={[6, 6, 2, 2]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="sales-chart-empty">Add price ranges to populate bands.</p>
            )}
          </div>
        </article>

        <article className="sales-chart-card">
          <header>
            <strong>Active buyers</strong>
            <span>Closed deals by buyer</span>
          </header>
          {data.topBuyers.length ? (
            <ul className="sales-buyer-list">
              {data.topBuyers.map((row) => (
                <li key={row.name}>
                  <span>{row.name}</span>
                  <strong>{row.deals}</strong>
                  <div className="sales-buyer-bar" style={{ width: `${Math.max(12, (row.deals / data.topBuyers[0].deals) * 100)}%` }} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="sales-chart-empty">Closed sales with buyers will appear here.</p>
          )}
        </article>
      </div>
    </section>
  );
}
