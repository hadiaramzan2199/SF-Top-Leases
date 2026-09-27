import { useCallback, useEffect, useMemo, useState } from 'react';
import { HiOutlineChartBar, HiOutlineBuildingOffice2 } from 'react-icons/hi2';
import { api } from '../api.js';
import CompList, { LeaseDetails } from '../components/CompList.jsx';
import MapView from '../components/MapView.jsx';
import StatsPanel from '../components/StatsPanel.jsx';
import Timeline from '../components/Timeline.jsx';
import FullscreenInsights from '../components/FullscreenInsights.jsx';
import { DEFAULT_LEASE_FILTERS, filterLeases } from '../lib/leaseFilters.js';

const DESKTOP_MQ = '(min-width: 901px)';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_MQ).matches : true
  ));

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MQ);
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return isDesktop;
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-page dashboard-loading" aria-label="Loading dashboard">
      <div className="workspace-grid">
        <aside className="stats-rail skeleton-panel"><div className="skeleton-stack"><i /><i /><i /><i /></div></aside>
        <section className="map-stage">
          <div className="map-card skeleton-map"><span className="skeleton-map-label">Preparing property map…</span></div>
          <div className="timeline-card skeleton-panel"><div className="skeleton-stack horizontal"><i /><i /><i /></div></div>
        </section>
        <aside className="comps-rail skeleton-panel"><div className="skeleton-stack"><i /><i /><i /><i /><i /></div></aside>
      </div>
    </div>
  );
}

function CompsPanel({
  allLeases,
  activeLease,
  activeLeaseId,
  onSelect,
  filters,
  onFiltersChange,
}) {
  return (
    <aside className="comps-rail">
      <LeaseDetails lease={activeLease} />
      <CompList
        leases={allLeases}
        activeLeaseId={activeLeaseId}
        onSelect={onSelect}
        filters={filters}
        onFiltersChange={onFiltersChange}
        filterOptionsLeases={allLeases}
      />
    </aside>
  );
}

function InsightsPanel({ leases, activeLeaseId, onSelectLease }) {
  return (
    <div className="insights-panel">
      <StatsPanel leases={leases} />
      <div className="insights-timeline">
        <Timeline
          leases={leases}
          activeLeaseId={activeLeaseId}
          onSelectLease={onSelectLease}
        />
      </div>
    </div>
  );
}

function buildProperties(leases, locationOverrides) {
  const unique = new Map();
  for (const lease of leases) {
    const property = lease.properties;
    if (!property) continue;
    const override = locationOverrides[property.id];
    const rent = Number(lease.yr1_rent_psf);
    const existing = unique.get(property.id);
    const nextRent = Number.isFinite(rent) ? rent : null;
    const bestRent = existing?.rent_psf != null && nextRent != null
      ? Math.max(existing.rent_psf, nextRent)
      : (existing?.rent_psf ?? nextRent);
    unique.set(property.id, {
      ...(override ? { ...property, ...override } : property),
      rent_psf: bestRent,
      marker_badge: bestRent != null ? `$${Math.round(bestRent)}` : '',
    });
  }
  return [...unique.values()];
}

export default function Dashboard() {
  const isDesktop = useIsDesktop();
  const [leases, setLeases] = useState([]);
  const [activeLeaseId, setActiveLeaseId] = useState(null);
  const [locationOverrides, setLocationOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mobileTab, setMobileTab] = useState('properties');
  const [filters, setFilters] = useState(DEFAULT_LEASE_FILTERS);

  useEffect(() => {
    let live = true;
    api.listLeases()
      .then((rows) => {
        if (!live) return;
        setLeases(rows);
      })
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  const visibleLeases = useMemo(() => filterLeases(leases, filters), [leases, filters]);

  const activeLease = useMemo(
    () => visibleLeases.find((lease) => lease.id === activeLeaseId)
      || leases.find((lease) => lease.id === activeLeaseId)
      || null,
    [visibleLeases, leases, activeLeaseId],
  );

  // Keep selection inside the filtered set so list/map stay aligned.
  useEffect(() => {
    if (activeLeaseId == null) return;
    if (visibleLeases.some((lease) => lease.id === activeLeaseId)) return;
    setActiveLeaseId(null);
  }, [visibleLeases, activeLeaseId]);

  const focusPropertyId = activeLease?.property_id ?? null;

  const properties = useMemo(
    () => buildProperties(visibleLeases, locationOverrides),
    [visibleLeases, locationOverrides],
  );

  const selectLease = useCallback((leaseId) => {
    setActiveLeaseId(leaseId);
    setMobileTab('properties');
  }, []);
  const clearSelection = useCallback(() => setActiveLeaseId(null), []);

  const selectProperty = useCallback((propertyId) => {
    const preferred = visibleLeases.find((lease) => lease.property_id === propertyId)
      || leases.find((lease) => lease.property_id === propertyId);
    if (preferred) {
      setActiveLeaseId(preferred.id);
      setMobileTab('properties');
    }
  }, [visibleLeases, leases]);

  const handleResolvedLocation = useCallback((property, coords) => {
    if (!property?.id || coords?.lat == null || coords?.lon == null) return;

    setLocationOverrides((current) => ({
      ...current,
      [property.id]: { latitude: coords.lat, longitude: coords.lon },
    }));

    api.updateProperty(property.id, {
      address: property.address,
      display_name: property.display_name,
      latitude: coords.lat,
      longitude: coords.lon,
      image_url: property.image_url,
    }).catch((err) => {
      console.warn(`Could not persist map location for property ${property.id}:`, err.message);
    });
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) {
    return <div className="page-state error-state"><strong>Could not load dashboard data</strong><small>{error}</small></div>;
  }

  return (
    <div className="dashboard-page">
      <div className={`workspace-grid mobile-tab-${mobileTab}`}>
        {isDesktop && (
          <aside className="stats-rail desktop-rail">
            <StatsPanel leases={visibleLeases} />
          </aside>
        )}

        <section className="map-stage">
          <MapView
            properties={properties}
            focusId={focusPropertyId}
            activeLease={activeLease}
            onSelectProperty={selectProperty}
            onClearSelection={clearSelection}
            onResolvedLocation={handleResolvedLocation}
            active
            fitToken={properties.map((property) => property.id).join(',')}
            fullscreenContent={(
              <FullscreenInsights
                leases={visibleLeases}
                activeLeaseId={activeLeaseId}
                onSelectLease={selectLease}
              />
            )}
          />
          {isDesktop && (
            <div className="desktop-timeline">
              <Timeline
                leases={visibleLeases}
                activeLeaseId={activeLeaseId}
                onSelectLease={selectLease}
              />
            </div>
          )}
        </section>

        {isDesktop && (
          <div className="desktop-comps">
            <CompsPanel
              allLeases={leases}
              activeLease={activeLease}
              activeLeaseId={activeLeaseId}
              onSelect={selectLease}
              filters={filters}
              onFiltersChange={setFilters}
            />
          </div>
        )}

        {!isDesktop && (
          <section className="mobile-bottom-panel" aria-label="Mobile details panel">
            <div className="mobile-dash-tabs" role="tablist" aria-label="Bottom panel">
              <button
                type="button"
                role="tab"
                aria-selected={mobileTab === 'properties'}
                className={mobileTab === 'properties' ? 'active' : ''}
                onClick={() => setMobileTab('properties')}
              >
                <HiOutlineBuildingOffice2 /> Properties
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileTab === 'insights'}
                className={mobileTab === 'insights' ? 'active' : ''}
                onClick={() => setMobileTab('insights')}
              >
                <HiOutlineChartBar /> Insights
              </button>
            </div>
            <div className="mobile-bottom-body">
              {mobileTab === 'properties' ? (
                <CompsPanel
                  allLeases={leases}
                  activeLease={activeLease}
                  activeLeaseId={activeLeaseId}
                  onSelect={selectLease}
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              ) : (
                <InsightsPanel
                  leases={visibleLeases}
                  activeLeaseId={activeLeaseId}
                  onSelectLease={selectLease}
                />
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
