import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { HiOutlineCurrencyDollar, HiOutlineSquare3Stack3D } from 'react-icons/hi2';
import { date, psf, sf } from '../lib/format.js';


const DAY = 24 * 60 * 60 * 1000;
const CHART = {
  tick: '#94A3B8',
  grid: '#E2E8F0',
  axis: '#E2E8F0',
  active: '#0F172A',
  idle: '#F5DE8A',
  stroke: '#E8C547',
};

function TimelineTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload.raw;
  return (
    <div className="timeline-tooltip">
      <strong>{row.tenant || 'Lease comp'}</strong>
      <span>{row.properties?.display_name || row.properties?.address}</span>
      <span>{metric === 'rent' ? psf(row.yr1_rent_psf) : sf(row.sf)} · {date(row.signed_date)}</span>
    </div>
  );
}

function monthlyTicks(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const start = new Date(min);
  start.setDate(1);
  start.setHours(12, 0, 0, 0);
  const end = new Date(max);
  end.setDate(1);
  end.setHours(12, 0, 0, 0);
  const ticks = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    ticks.push(cursor.getTime());
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return [...new Set(ticks)];
}

export default function Timeline({ leases, activeLeaseId, onSelectLease, variant = 'default' }) {
  const [metric, setMetric] = useState('rent');

  const points = useMemo(() => leases
    .filter((lease) => lease.signed_date)
    .map((lease) => ({
      x: new Date(`${lease.signed_date}T12:00:00`).getTime(),
      y: metric === 'rent' ? Number(lease.yr1_rent_psf) : Number(lease.sf),
      z: Number(lease.sf) || 45000,
      raw: lease,
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)), [leases, metric]);

  const dateValues = points.map((point) => point.x);
  const minDate = dateValues.length ? Math.min(...dateValues) : NaN;
  const maxDate = dateValues.length ? Math.max(...dateValues) : NaN;
  const ticks = useMemo(() => monthlyTicks(minDate, maxDate), [minDate, maxDate]);

  const start = Number.isFinite(minDate) ? new Date(minDate) : null;
  const end = Number.isFinite(maxDate) ? new Date(maxDate) : null;
  const rangeLabel = start && end
    ? `${start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
    : 'No dated leases';

  return (
    <section className={`timeline-card ${variant === 'fullscreen' ? 'fullscreen-timeline' : ''}`}>
      <div className="timeline-head">
        <div>
          <span className="eyebrow">Lease timeline</span>
          <div className="timeline-title-row">
            <h2>{rangeLabel}</h2>
            <span>Circle size represents deal size</span>
          </div>
        </div>
        <div className="segmented" role="group" aria-label="Timeline metric">
          <button className={metric === 'rent' ? 'active' : ''} onClick={() => setMetric('rent')}>
            <HiOutlineCurrencyDollar /> Rent
          </button>
          <button className={metric === 'area' ? 'active' : ''} onClick={() => setMetric('area')}>
            <HiOutlineSquare3Stack3D /> Leased area
          </button>
        </div>
      </div>

      <div className="timeline-chart">
        <ResponsiveContainer width="100%" height="100%" minHeight={120}>
          <ScatterChart margin={{ top: 12, right: 20, bottom: 8, left: 4 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="4 6" vertical={false} />
            <XAxis
              type="number"
              dataKey="x"
              domain={Number.isFinite(minDate) ? [minDate - (7 * DAY), maxDate + (7 * DAY)] : ['auto', 'auto']}
              ticks={ticks}
              scale="time"
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short' })}
              tick={{ fill: CHART.tick, fontSize: 11, fontFamily: '"Google Sans", sans-serif' }}
              axisLine={{ stroke: CHART.axis }}
              tickLine={false}
              minTickGap={28}
              height={32}
            />
            <YAxis
              type="number"
              dataKey="y"
              width={52}
              tickFormatter={(value) => metric === 'rent' ? `$${Math.round(value)}` : `${Math.round(value / 1000)}k`}
              tick={{ fill: CHART.tick, fontSize: 11, fontFamily: '"Google Sans", sans-serif' }}
              axisLine={false}
              tickLine={false}
            />
            <ZAxis type="number" dataKey="z" range={[56, 280]} />
            <Tooltip cursor={{ stroke: '#CBD5E1', strokeDasharray: '4 4' }} content={<TimelineTooltip metric={metric} />} />
            <Scatter
              data={points}
              fill={CHART.idle}
              onClick={(entry) => {
                const id = entry?.payload?.raw?.id ?? entry?.raw?.id;
                if (id != null) onSelectLease?.(id);
              }}
              style={{ cursor: 'pointer' }}
            >
              {points.map((point) => (
                <Cell
                  key={`lease-${point.raw.id}`}
                  fill={point.raw.id === activeLeaseId ? CHART.active : CHART.idle}
                  fillOpacity={point.raw.id === activeLeaseId ? 1 : 0.85}
                  stroke={point.raw.id === activeLeaseId ? '#FFFFFF' : CHART.stroke}
                  strokeWidth={point.raw.id === activeLeaseId ? 3 : 1.5}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
