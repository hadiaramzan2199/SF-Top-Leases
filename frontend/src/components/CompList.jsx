import { useEffect, useMemo, useState } from 'react';
import {
  HiOutlineArrowsUpDown,
  HiOutlineFunnel,
  HiOutlineMagnifyingGlass,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { date, months, psf, psfCompact, sf, sfCompact } from '../lib/format.js';
import {
  DEFAULT_LEASE_FILTERS,
  activeFilterCount,
  filterLeases,
  sortLeases,
} from '../lib/leaseFilters.js';

const buildingTitle = (property = {}) => property.address?.split(',')[0] || property.display_name || 'Property';

function locationLine(property = {}) {
  const parts = String(property.address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) return `${parts[1]}, ${parts[2]}`;
  if (parts.length === 2) return parts[1];
  return property.display_name && property.display_name !== buildingTitle(property)
    ? property.display_name
    : 'San Francisco, CA';
}

function propertyImage(property = {}) {
  return property.image_url || '';
}

function statusTone(lease) {
  const deal = String(lease.deal_type || '').toLowerCase();
  if (deal.includes('renew')) return { label: lease.deal_type || 'Renewal', tone: 'pending' };
  if (deal.includes('expansion')) return { label: lease.deal_type || 'Expansion', tone: 'pending' };
  if (deal.includes('sublease')) return { label: lease.deal_type || 'Sublease', tone: 'vacant' };
  return { label: lease.deal_type || lease.lease_type || 'Lease', tone: 'rented' };
}

export function LeaseDetails({ lease }) {
  if (!lease) return null;

  const property = lease.properties || {};
  const image = propertyImage(property);
  const details = [
    ['Leased area', sf(lease.sf)],
    ['Rate /SF/Yr', psf(lease.yr1_rent_psf)],
    ['Term', months(lease.term_months)],
    ['Escalation', lease.escalation_pct == null ? '—' : `${lease.escalation_pct}%`],
    ['TI / SF', lease.ti_psf == null ? '—' : `$${Number(lease.ti_psf).toFixed(2)}`],
    ['Free rent', months(lease.free_rent_months)],
    ['Executed', date(lease.signed_date)],
    ['Deal type', lease.deal_type || '—'],
    ['Lease type', lease.lease_type || '—'],
    ['Floors', lease.floors || '—'],
  ];

  return (
    <article className="selected-comp">
      <div className="selected-summary">
        <div className="selected-thumb">
          {image ? <img src={image} alt="" /> : <span className="comp-photo-empty">No photo</span>}
        </div>
        <div className="selected-copy">
          <span className="eyebrow">Selected comp</span>
          <h2>{buildingTitle(property)}</h2>
          <p>{lease.tenant || 'Tenant not provided'}</p>
          <span className="selected-address">{property.address}</span>
        </div>
      </div>

      <div className="selected-kpis">
        <span><small>Area</small><strong>{sf(lease.sf)}</strong></span>
        <span><small>Rent</small><strong>{psf(lease.yr1_rent_psf)}</strong></span>
      </div>

      <details className="detail-dropdown">
        <summary><span>Lease details</span><span className="chevron">⌄</span></summary>
        <div className="detail-grid">
          {details.map(([label, value]) => (
            <div key={label} className="detail-cell">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </details>

      {lease.notes && (
        <details className="detail-dropdown notes-dropdown">
          <summary><span>Notes</span><span className="chevron">⌄</span></summary>
          <p>{lease.notes}</p>
        </details>
      )}
    </article>
  );
}

export default function CompList({
  leases,
  activeLeaseId,
  onSelect,
  filters = DEFAULT_LEASE_FILTERS,
  onFiltersChange,
  filterOptionsLeases,
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const optionSource = filterOptionsLeases || leases;
  const dealTypes = useMemo(() => {
    return [...new Set(optionSource.map((lease) => lease.deal_type).filter(Boolean))].sort();
  }, [optionSource]);

  const leaseTypes = useMemo(() => {
    return [...new Set(optionSource.map((lease) => lease.lease_type).filter(Boolean))].sort();
  }, [optionSource]);

  const sorted = useMemo(
    () => sortLeases(filterLeases(leases, filters), filters.sort),
    [leases, filters],
  );

  useEffect(() => {
    if (activeLeaseId == null) return;
    const node = document.querySelector(`[data-lease-id="${activeLeaseId}"]`);
    node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeLeaseId]);

  const activeFilters = activeFilterCount(filters);
  const setFilter = (key, value) => onFiltersChange?.({ ...filters, [key]: value });

  function clearFilters() {
    onFiltersChange?.({ ...DEFAULT_LEASE_FILTERS, sort: filters.sort || 'newest' });
    setSearchOpen(false);
  }

  return (
    <div className="comp-list">
      <div className="comp-list-head">
        <div>
          <span className="eyebrow">Market comps</span>
          <h2>Comparables <em>{sorted.length}</em></h2>
        </div>
        <div className="comp-head-actions">
          <button
            type="button"
            className={`comp-icon-btn ${searchOpen || filters.query ? 'active' : ''}`}
            onClick={() => {
              setSearchOpen((open) => !open);
              setFiltersOpen(false);
            }}
            aria-label="Search comps"
            title="Search"
          >
            <HiOutlineMagnifyingGlass />
          </button>
          <button
            type="button"
            className={`comp-icon-btn ${filtersOpen || activeFilters ? 'active' : ''}`}
            onClick={() => {
              setFiltersOpen((open) => !open);
              setSearchOpen(false);
            }}
            aria-label="Filter comps"
            title="Filters"
          >
            <HiOutlineFunnel />
            {activeFilters > 0 && <i>{activeFilters}</i>}
          </button>
          <label className="comp-sort-icon" title="Sort">
            <HiOutlineArrowsUpDown aria-hidden="true" />
            <select
              value={filters.sort || 'newest'}
              onChange={(event) => setFilter('sort', event.target.value)}
              aria-label="Sort lease comps"
            >
              <option value="newest">Newest</option>
              <option value="largest">Largest area</option>
              <option value="rent">Highest rent</option>
              <option value="lowest-rent">Lowest rent</option>
            </select>
          </label>
        </div>
      </div>

      {(searchOpen || filters.query) && (
        <div className="comp-filter-drawer">
          <label className="comp-search">
            <HiOutlineMagnifyingGlass aria-hidden="true" />
            <input
              autoFocus={searchOpen}
              value={filters.query || ''}
              onChange={(event) => setFilter('query', event.target.value)}
              placeholder="Search tenant or building"
            />
            {filters.query && (
              <button type="button" className="comp-icon-btn tiny" onClick={() => setFilter('query', '')} aria-label="Clear search">
                <HiOutlineXMark />
              </button>
            )}
          </label>
        </div>
      )}

      {filtersOpen && (
        <div className="comp-filter-drawer compact">
          <div className="comp-filter-row">
            <select value={filters.dealType || 'all'} onChange={(event) => setFilter('dealType', event.target.value)} aria-label="Deal type">
              <option value="all">All deals</option>
              {dealTypes.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select value={filters.leaseType || 'all'} onChange={(event) => setFilter('leaseType', event.target.value)} aria-label="Lease type">
              <option value="all">All leases</option>
              {leaseTypes.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
          <div className="comp-filter-row">
            <select value={filters.minSf || 'all'} onChange={(event) => setFilter('minSf', event.target.value)} aria-label="Minimum size">
              <option value="all">Any size</option>
              <option value="50k">50k+ SF</option>
              <option value="100k">100k+ SF</option>
              <option value="200k">200k+ SF</option>
            </select>
            {activeFilters > 0 ? (
              <button type="button" className="comp-clear-filters" onClick={clearFilters}>
                Clear
              </button>
            ) : (
              <span className="comp-filter-hint">Filters</span>
            )}
          </div>
        </div>
      )}

      <div className="comp-scroll">
        {sorted.length === 0 ? (
          <div className="comp-empty">No comps match these filters.</div>
        ) : sorted.map((lease) => {
          const property = lease.properties || {};
          const status = statusTone(lease);
          const image = propertyImage(property);
          const rentLabel = lease.yr1_rent_psf == null ? '—' : `${psfCompact(lease.yr1_rent_psf)}`;
          return (
            <button
              type="button"
              key={lease.id}
              data-lease-id={lease.id}
              className={`comp-card photo-card ${activeLeaseId === lease.id ? 'active' : ''}`}
              onClick={() => onSelect?.(lease.id)}
            >
              <span className="comp-card-head">
                <strong>{buildingTitle(property)}</strong>
                <span>{locationLine(property)}</span>
              </span>

              <span className={`comp-photo ${image ? '' : 'is-empty'}`.trim()}>
                {image ? <img src={image} alt="" /> : <span className="comp-photo-empty">No building photo</span>}
                <span className={`comp-badge tone-${status.tone}`}>{status.label}</span>
              </span>

              <span className="comp-stats">
                <span>
                  <strong>{sfCompact(lease.sf)}</strong>
                  <small>leased area</small>
                </span>
                <span>
                  <strong>{rentLabel}</strong>
                  <small>rent /SF/Yr</small>
                </span>
                <span>
                  <strong>{months(lease.term_months)}</strong>
                  <small>term</small>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
