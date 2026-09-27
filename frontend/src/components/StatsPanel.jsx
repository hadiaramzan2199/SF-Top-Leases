import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  HiOutlineArrowTrendingUp,
  HiOutlineChartBar,
  HiOutlineCurrencyDollar,
} from 'react-icons/hi2';
import { psf, sf, sfCompact, psfCompact } from '../lib/format.js';

const COLORS = {
  blue: '#E8C547',
  navy: '#0F172A',
  mint: '#10B981',
  amber: '#FCECAE',
  rose: '#F43F5E',
  violet: '#8B5CF6',
  sky: '#F5DE8A',
  slate: '#94A3B8',
  grid: '#E2E8F0',
  tick: '#94A3B8',
};

const PIE_PALETTE = [COLORS.blue, COLORS.mint, COLORS.amber, COLORS.violet, COLORS.rose, COLORS.navy, COLORS.sky];

function histogram(values, bins = 6, money = false) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return [];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const step = (max - min) / bins || 1;

  return Array.from({ length: bins }, (_, index) => {
    const start = min + index * step;
    const end = index === bins - 1 ? max : min + (index + 1) * step;
    const count = nums.filter((value) => value >= start && (index === bins - 1 ? value <= end : value < end)).length;
    const label = money
      ? `$${Math.round(start)}`
      : `${Math.round(start / 1000)}k`;
    return { label, count, full: money ? `$${Math.round(start)}–$${Math.round(end)}` : `${Math.round(start / 1000)}k–${Math.round(end / 1000)}k` };
  });
}

function median(values) {
  const nums = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  const midpoint = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[midpoint] : (nums[midpoint - 1] + nums[midpoint]) / 2;
}

function weightedAverage(rows) {
  const clean = rows
    .map((row) => ({ rent: Number(row.yr1_rent_psf), sf: Number(row.sf) }))
    .filter((row) => Number.isFinite(row.rent) && Number.isFinite(row.sf) && row.sf > 0);
  const weight = clean.reduce((sum, row) => sum + row.sf, 0);
  return weight ? clean.reduce((sum, row) => sum + row.rent * row.sf, 0) / weight : null;
}

function monthlyTrend(leases) {
  const buckets = new Map();
  for (const lease of leases) {
    if (!lease.signed_date || lease.yr1_rent_psf == null) continue;
    const key = lease.signed_date.slice(0, 7);
    const current = buckets.get(key) || { month: key, rentSum: 0, sfSum: 0, deals: 0 };
    current.rentSum += Number(lease.yr1_rent_psf) * (Number(lease.sf) || 1);
    current.sfSum += Number(lease.sf) || 1;
    current.deals += 1;
    buckets.set(key, current);
  }
  return [...buckets.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({
      label: new Date(`${row.month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short' }),
      avgRent: Math.round((row.rentSum / row.sfSum) * 10) / 10,
      deals: row.deals,
    }));
}

function dealMix(leases) {
  const counts = new Map();
  for (const lease of leases) {
    const key = lease.deal_type || lease.lease_type || 'Other';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function ChartTooltip({ active, payload, label }) {
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

function KpiStrip({ items }) {
  return (
    <div className="kpi-strip" role="list" aria-label="Market snapshot">
      {items.map(({ label, value, tone }) => (
        <div key={label} className={`kpi-strip-item tone-${tone}`} role="listitem">
          <small>{label}</small>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function FullscreenHistogram({ data }) {
  const peak = Math.max(0, ...data.map((row) => row.count));
  return (
    <div className="fullscreen-histogram">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 6, left: 6, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={COLORS.grid} strokeDasharray="3 6" />
          <XAxis dataKey="label" tick={{ fill: COLORS.tick, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} height={28} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(59,130,246,.06)' }} />
          <Bar dataKey="count" name="Deals" radius={[8, 8, 4, 4]} maxBarSize={40}>
            {data.map((entry, index) => (
              <Cell key={`${entry.label}-${index}`} fill={entry.count === peak && peak > 0 ? COLORS.blue : '#BFDBFE'} />
            ))}
            <LabelList dataKey="count" position="top" fill="#0F172A" fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FullscreenStats({ leases }) {
  const rents = leases.map((lease) => lease.yr1_rent_psf).filter((value) => value != null);
  const areas = leases.map((lease) => lease.sf).filter((value) => value != null);
  const safeMax = (values) => values.length ? Math.max(...values.map(Number)) : null;
  const safeMin = (values) => values.length ? Math.min(...values.map(Number)) : null;

  return (
    <div className="fullscreen-stats-card">
      <div className="fullscreen-stats-title"><span className="lease-dot" /> Lease comps</div>
      <section className="fullscreen-stat-section">
        <div className="fullscreen-stat-label">Rent</div>
        <div className="fullscreen-kpi-grid">
          <div><span>Highest</span><strong>{psf(safeMax(rents))}</strong></div>
          <div className="warm"><span>Wtd. average</span><strong>{psf(weightedAverage(leases))}</strong></div>
          <div><span>Median</span><strong>{psf(median(rents))}</strong></div>
          <div><span>Lowest</span><strong>{psf(safeMin(rents))}</strong></div>
        </div>
        <FullscreenHistogram data={histogram(rents, 7, true)} />
      </section>
      <section className="fullscreen-stat-section">
        <div className="fullscreen-stat-label">Leased area</div>
        <div className="fullscreen-kpi-grid">
          <div><span>Largest</span><strong>{sf(safeMax(areas))}</strong></div>
          <div className="warm"><span>Median</span><strong>{sf(median(areas))}</strong></div>
          <div><span>Smallest</span><strong>{sf(safeMin(areas))}</strong></div>
          <div><span>Total SF</span><strong>{sf(areas.reduce((sum, value) => sum + Number(value), 0))}</strong></div>
        </div>
        <FullscreenHistogram data={histogram(areas, 7)} />
      </section>
    </div>
  );
}

function RailStats({ leases }) {
  const rents = useMemo(() => leases.map((lease) => lease.yr1_rent_psf).filter((value) => value != null), [leases]);
  const areas = useMemo(() => leases.map((lease) => lease.sf).filter((value) => value != null), [leases]);
  const trend = useMemo(() => monthlyTrend(leases), [leases]);
  const mix = useMemo(() => dealMix(leases), [leases]);
  const rentBins = useMemo(() => histogram(rents, 6, true), [rents]);
  const peak = Math.max(0, ...rentBins.map((row) => row.count));

  const totalSf = areas.reduce((sum, value) => sum + Number(value), 0);
  const avgRent = weightedAverage(leases);
  const medRent = median(rents);

  return (
    <div className="stats-stack">
      <div className="rail-heading rail-heading-compact">
        <div>
          <span className="eyebrow">Overview</span>
          <h2>Market stats</h2>
        </div>
      </div>

      <KpiStrip
        items={[
          { label: 'Deals', value: leases.length, tone: 'navy' },
          { label: 'Total SF', value: sfCompact(totalSf), tone: 'blue' },
          { label: 'Wtd avg', value: psfCompact(avgRent), tone: 'mint' },
          { label: 'Median', value: psfCompact(medRent), tone: 'amber' },
        ]}
      />

      <section className="stats-card">
        <div className="stats-card-head">
          <HiOutlineArrowTrendingUp />
          <div>
            <strong>Rent trend</strong>
            <span>Weighted avg by month</span>
          </div>
        </div>
        <div className="trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 6, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="rentTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={COLORS.blue} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={COLORS.grid} strokeDasharray="3 6" />
              <XAxis dataKey="label" tick={{ fill: COLORS.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: COLORS.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="avgRent"
                name="Avg rent"
                stroke={COLORS.blue}
                strokeWidth={2.5}
                fill="url(#rentTrendFill)"
                dot={{ r: 3, fill: COLORS.navy, stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="stats-card">
        <div className="stats-card-head">
          <HiOutlineChartBar />
          <div>
            <strong>Deal mix</strong>
            <span>By deal type</span>
          </div>
        </div>
        <div className="pie-layout">
          <div className="pie-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={mix} dataKey="value" nameKey="name" innerRadius={34} outerRadius={52} paddingAngle={3} stroke="#fff" strokeWidth={2}>
                  {mix.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_PALETTE[index % PIE_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="pie-legend">
            {mix.slice(0, 5).map((entry, index) => (
              <div key={entry.name} className="pie-legend-row">
                <i style={{ background: PIE_PALETTE[index % PIE_PALETTE.length] }} />
                <span>{entry.name}</span>
                <strong>{entry.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="stats-card">
        <div className="stats-card-head">
          <HiOutlineCurrencyDollar />
          <div>
            <strong>Rent bands</strong>
            <span>Deal count by $/SF</span>
          </div>
        </div>
        <div className="mini-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rentBins} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={COLORS.grid} strokeDasharray="3 6" />
              <XAxis dataKey="label" tick={{ fill: COLORS.tick, fontSize: 9 }} axisLine={false} tickLine={false} height={24} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload;
                  return (
                    <div className="stats-tooltip">
                      <strong>{row.full}</strong>
                      <span>Deals: {row.count}</span>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" name="Deals" radius={[8, 8, 4, 4]} maxBarSize={26}>
                {rentBins.map((entry, index) => (
                  <Cell key={`${entry.label}-${index}`} fill={entry.count === peak && peak > 0 ? COLORS.navy : COLORS.blue} fillOpacity={entry.count === peak ? 1 : 0.55} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="metric-list">
          <div className="metric-row"><span>Highest</span><strong>{psf(rents.length ? Math.max(...rents.map(Number)) : null)}</strong></div>
          <div className="metric-row"><span>Lowest</span><strong>{psf(rents.length ? Math.min(...rents.map(Number)) : null)}</strong></div>
        </div>
      </section>
    </div>
  );
}

export default function StatsPanel({ leases, variant = 'rail' }) {
  if (variant === 'fullscreen') return <FullscreenStats leases={leases} />;
  return <RailStats leases={leases} />;
}
