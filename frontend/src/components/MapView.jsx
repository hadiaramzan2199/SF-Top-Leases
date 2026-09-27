import { useEffect, useMemo, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import {
  HiOutlineArrowsPointingOut,
  HiOutlineHome,
  HiOutlineMagnifyingGlass,
  HiOutlineMap,
  HiOutlineCube,
} from 'react-icons/hi2';
import { date, psf, sf } from '../lib/format.js';
import {
  createViewer,
  addPhotorealistic,
  sharpenPhotorealistic,
  setMode,
  addPin,
  setActivePin,
  flyTo,
  flyHome,
  flyToLocations,
  screenToLonLat,
  pinToScreen,
  sampleRoofHeight,
  setPinRoofHeight,
  googleGeocode,
  destinationCenter,
  viewerAlive,
} from '../lib/cesium.js';

const TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function PropertyPopup({ property, lease, position, onClose }) {
  if (!property || !position) return null;
  const title = property.address?.split(',')[0] || property.display_name || 'Selected property';
  return (
    <div
      className="map-property-popup map-floating-popup anchored-popup"
      style={{ left: position.x, top: position.y }}
      role="status"
    >
      <button className="map-popup-close" onClick={onClose} aria-label="Close selected property popup">×</button>
      <span className="popup-kicker">Selected property</span>
      <strong>{title}</strong>
      <span className="popup-address">{property.address}</span>
      {lease && (
        <div className="popup-lease-row">
          <span><small>Tenant</small><b>{lease.tenant || '—'}</b></span>
          <span><small>Area</small><b>{sf(lease.sf)}</b></span>
          <span><small>Rent</small><b>{psf(lease.yr1_rent_psf)}</b></span>
          <span><small>Executed</small><b>{date(lease.signed_date)}</b></span>
        </div>
      )}
    </div>
  );
}

function CoordinatePopup({ point, onClose }) {
  if (!point) return null;
  return (
    <div
      className="map-coordinate-popup map-floating-popup"
      style={{ left: point.x, top: point.y }}
      role="status"
    >
      <button className="map-popup-close" onClick={onClose} aria-label="Close coordinate popup">×</button>
      <span className="popup-kicker">Map location</span>
      <strong>{point.lat.toFixed(6)}, {point.lon.toFixed(6)}</strong>
      <span className="popup-address">Latitude / longitude</span>
    </div>
  );
}

export default function MapView({
  properties = [],
  focusId,
  activeLease,
  onSelectProperty,
  onClearSelection,
  onResolvedLocation,
  fullscreenContent = null,
  active = true,
  fitToken = '',
}) {
  const shellRef = useRef(null);
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const tilesetRef = useRef(null);
  const handlerRef = useRef(null);
  const geocodeStateRef = useRef(new Map());
  const roofHeightsRef = useRef(new Map());
  const tileReadyCleanupRef = useRef(null);
  const postRenderCleanupRef = useRef(null);
  const readyTimerRef = useRef(null);
  const propertiesRef = useRef(properties);
  const displayPropertiesRef = useRef([]);
  const onSelectPropertyRef = useRef(onSelectProperty);
  const propertyPopupRef = useRef(null);
  const fullscreenRef = useRef(false);
  const fittedRef = useRef(false);

  const [mode, setModeState] = useState('3d');
  const [status, setStatus] = useState('loading');
  const [resolved, setResolved] = useState({});
  const [locating, setLocating] = useState(false);
  const [propertyPopup, setPropertyPopup] = useState(null);
  const [coordinatePopup, setCoordinatePopup] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const displayProperties = useMemo(() => properties.map((property) => {
    const location = resolved[property.id];
    return location ? { ...property, ...location } : property;
  }), [properties, resolved]);

  const selectedProperty = useMemo(
    () => displayProperties.find((property) => property.id === focusId) || null,
    [displayProperties, focusId],
  );

  const mappedLocations = useMemo(
    () => displayProperties
      .filter((property) => property.latitude != null && property.longitude != null)
      .map((property) => ({ lon: Number(property.longitude), lat: Number(property.latitude) })),
    [displayProperties],
  );

  function fitToPortfolio(viewer, nextMode = mode, duration = 1.0) {
    if (!viewerAlive(viewer)) return;
    const fitted = flyToLocations(viewer, mappedLocations, nextMode, duration);
    if (fitted) fittedRef.current = true;
  }

  useEffect(() => { propertiesRef.current = properties; }, [properties]);
  useEffect(() => { displayPropertiesRef.current = displayProperties; }, [displayProperties]);
  useEffect(() => { onSelectPropertyRef.current = onSelectProperty; }, [onSelectProperty]);
  useEffect(() => { propertyPopupRef.current = propertyPopup; }, [propertyPopup]);
  useEffect(() => { fullscreenRef.current = isFullscreen; }, [isFullscreen]);

  const popupProperty = useMemo(() => {
    if (!propertyPopup?.propertyId) return null;
    return displayProperties.find((property) => property.id === propertyPopup.propertyId) || null;
  }, [displayProperties, propertyPopup]);

  function popupPosition(rawX, rawY, width = 294, height = 178) {
    const box = containerRef.current?.getBoundingClientRect();
    const w = box?.width || 800;
    const h = box?.height || 560;
    const reservedRight = fullscreenRef.current ? Math.min(440, Math.max(330, w * 0.31)) : 0;
    const usableRight = Math.max(width + 20, w - reservedRight);
    const preferLeft = rawX + width + 30 > usableRight;
    const x = preferLeft ? rawX - width - 20 : rawX + 20;
    const y = rawY - Math.min(92, height / 2);
    return {
      x: clamp(x, 10, Math.max(10, usableRight - width - 10)),
      y: clamp(y, fullscreenRef.current ? 82 : 10, Math.max(10, h - height - 10)),
    };
  }

  function updatePopupFromPin(propertyId) {
    const viewer = viewerRef.current;
    if (!viewerAlive(viewer) || propertyId == null) return;
    const point = pinToScreen(viewer, propertyId);
    if (!point) return;
    const next = popupPosition(point.x, point.y);
    setPropertyPopup((current) => {
      if (!current || current.propertyId !== propertyId) return current;
      if (Math.abs((current.x ?? 0) - next.x) < 0.75 && Math.abs((current.y ?? 0) - next.y) < 0.75) return current;
      return { ...current, ...next };
    });
  }

  function openPropertyPopup(property) {
    if (!property) return;
    const viewer = viewerRef.current;
    const point = viewerAlive(viewer) ? pinToScreen(viewer, property.id) : null;
    const box = containerRef.current?.getBoundingClientRect();
    const fallback = { x: (box?.width || 800) * 0.5, y: (box?.height || 560) * 0.48 };
    const pos = popupPosition(point?.x ?? fallback.x, point?.y ?? fallback.y);
    setCoordinatePopup(null);
    setPropertyPopup({ propertyId: property.id, ...pos });
  }

  useEffect(() => {
    const onFullscreenChange = () => {
      const activeFs = document.fullscreenElement === shellRef.current;
      setIsFullscreen(activeFs);
      setTimeout(() => {
        const viewer = viewerRef.current;
        if (viewerAlive(viewer)) {
          viewer.resize();
          viewer.scene.requestRender();
          if (propertyPopupRef.current?.propertyId) updatePopupFromPin(propertyPopupRef.current.propertyId);
        }
      }, 80);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    const timer = setTimeout(() => {
      const viewer = viewerRef.current;
      if (!viewerAlive(viewer)) return;
      viewer.resize();
      viewer.scene.requestRender();
    }, 120);
    return () => clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    const host = shellRef.current || containerRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;

    let frame = 0;
    let lastW = 0;
    let lastH = 0;
    const resizeViewer = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewer = viewerRef.current;
        if (!viewerAlive(viewer)) return;
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (width < 2 || height < 2) return;
        if (width === lastW && height === lastH) {
          viewer.scene.requestRender();
          return;
        }
        lastW = width;
        lastH = height;
        viewer.resize();
        viewer.scene.requestRender();
      });
    };

    const observer = new ResizeObserver(resizeViewer);
    observer.observe(host);
    // Mobile often mounts Cesium before the grid assigns height — nudge after layout.
    const t1 = setTimeout(resizeViewer, 100);
    const t2 = setTimeout(resizeViewer, 400);
    window.addEventListener('orientationchange', resizeViewer);
    window.addEventListener('resize', resizeViewer);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(t1);
      clearTimeout(t2);
      observer.disconnect();
      window.removeEventListener('orientationchange', resizeViewer);
      window.removeEventListener('resize', resizeViewer);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let viewer;

    try {
      if (!TOKEN) throw new Error('VITE_CESIUM_ION_TOKEN is missing from frontend/.env');
      viewer = createViewer(containerRef.current, TOKEN);
      viewerRef.current = viewer;

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handlerRef.current = handler;
      handler.setInputAction((event) => {
        if (!viewerAlive(viewer)) return;
        const picked = viewer.scene.pick(event.position);
        const id = picked?.id?.id ?? picked?.id;
        if (typeof id === 'string' && id.startsWith('property-')) {
          const propertyId = Number(id.replace('property-', ''));
          const property = displayPropertiesRef.current.find((item) => item.id === propertyId)
            || propertiesRef.current.find((item) => item.id === propertyId);
          onSelectPropertyRef.current?.(propertyId);
          if (property) openPropertyPopup(property);
          return;
        }

        const ll = screenToLonLat(viewer, event.position);
        if (ll) {
          const pos = popupPosition(event.position.x, event.position.y, 248, 105);
          setPropertyPopup(null);
          setCoordinatePopup({ ...pos, lat: ll.lat, lon: ll.lon });
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      const removePostRender = viewer.scene.postRender.addEventListener(() => {
        const current = propertyPopupRef.current;
        if (current?.propertyId != null) updatePopupFromPin(current.propertyId);
      });
      postRenderCleanupRef.current = removePostRender;

      addPhotorealistic(viewer).then((tileset) => {
        if (disposed || !viewerAlive(viewer)) return;
        tilesetRef.current = tileset;
        if (!tileset) {
          setMode(viewer, null, '2d');
          setModeState('2d');
          const locs = displayPropertiesRef.current
            .filter((p) => p.latitude != null && p.longitude != null)
            .map((p) => ({ lon: Number(p.longitude), lat: Number(p.latitude) }));
          if (locs.length) {
            flyToLocations(viewer, locs, '2d', 0.5);
            fittedRef.current = true;
          } else {
            flyHome(viewer, '2d', 0.4);
          }
          setStatus('fallback');
          return;
        }

        setMode(viewer, tileset, '3d');
        const locs = displayPropertiesRef.current
          .filter((p) => p.latitude != null && p.longitude != null)
          .map((p) => ({ lon: Number(p.longitude), lat: Number(p.latitude) }));
        if (locs.length) {
          flyToLocations(viewer, locs, '3d', 0.55);
          fittedRef.current = true;
        } else {
          flyHome(viewer, '3d', 0.45);
        }
        setStatus('streaming');

        const markReady = () => {
          if (disposed) return;
          sharpenPhotorealistic(viewer, tileset);
          setStatus('ready');
          if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
        };
        tileReadyCleanupRef.current = tileset.initialTilesLoaded?.addEventListener(markReady) || null;
        readyTimerRef.current = setTimeout(markReady, 8500);
      });
    } catch (error) {
      console.error(error);
      setStatus('error');
    }

    return () => {
      disposed = true;
      tileReadyCleanupRef.current?.();
      tileReadyCleanupRef.current = null;
      postRenderCleanupRef.current?.();
      postRenderCleanupRef.current = null;
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
      if (handlerRef.current && !handlerRef.current.isDestroyed()) handlerRef.current.destroy();
      handlerRef.current = null;
      if (viewerAlive(viewer)) viewer.destroy();
      viewerRef.current = null;
      tilesetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolveLocation(property) {
    const viewer = viewerRef.current;
    if (!viewerAlive(viewer) || !property?.id || !property.address) return null;
    if (property.latitude != null && property.longitude != null) {
      return { latitude: Number(property.latitude), longitude: Number(property.longitude) };
    }
    const existing = resolved[property.id];
    if (existing) return existing;
    if (geocodeStateRef.current.get(property.id) === 'working') return null;
    if (geocodeStateRef.current.get(property.id) === 'failed') return null;

    geocodeStateRef.current.set(property.id, 'working');
    try {
      const hits = await googleGeocode(viewer, `${property.address}, USA`, TOKEN);
      const center = hits?.[0] ? destinationCenter(hits[0].destination) : null;
      if (!center) {
        geocodeStateRef.current.set(property.id, 'failed');
        return null;
      }
      const location = { latitude: center.lat, longitude: center.lon };
      geocodeStateRef.current.set(property.id, 'done');
      setResolved((current) => ({ ...current, [property.id]: location }));
      onResolvedLocation?.(property, { lat: center.lat, lon: center.lon });
      return location;
    } catch (error) {
      geocodeStateRef.current.set(property.id, 'failed');
      console.warn(`Could not geocode ${property.address}:`, error.message);
      return null;
    }
  }

  useEffect(() => {
    if (!viewerAlive(viewerRef.current) || status === 'error') return undefined;
    let cancelled = false;

    const missing = properties
      .filter((property) => property.latitude == null || property.longitude == null)
      .sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId));
    if (!missing.length) {
      setLocating(false);
      return undefined;
    }

    setLocating(true);
    (async () => {
      for (const property of missing) {
        if (cancelled) break;
        await resolveLocation(property);
        await pause(90);
      }
      if (!cancelled) setLocating(false);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, focusId, status]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewerAlive(viewer)) return undefined;
    let cancelled = false;

    viewer.entities.removeAll();
    displayProperties.forEach((property) => {
      if (property.latitude == null || property.longitude == null) return;
      const roofHeight = mode === '3d' ? roofHeightsRef.current.get(property.id) : null;
      addPin(viewer, {
        id: property.id,
        lon: property.longitude,
        lat: property.latitude,
        label: property.address?.split(',')[0] || property.display_name || 'Property',
        badge: property.marker_badge || '',
        meta: { propertyId: property.id },
        roofHeight,
        heightReference: mode === '3d'
          ? Cesium.HeightReference.CLAMP_TO_3D_TILE
          : Cesium.HeightReference.CLAMP_TO_GROUND,
      });
    });
    setActivePin(viewer, focusId);

    if (mode === '3d' && status === 'ready') {
      (async () => {
        for (const property of displayProperties) {
          if (cancelled || !viewerAlive(viewer)) break;
          if (property.latitude == null || property.longitude == null) continue;
          let height = roofHeightsRef.current.get(property.id);
          if (!Number.isFinite(Number(height))) {
            height = await sampleRoofHeight(viewer, property.longitude, property.latitude);
            if (Number.isFinite(Number(height))) roofHeightsRef.current.set(property.id, Number(height));
          }
          if (!cancelled && Number.isFinite(Number(height))) {
            setPinRoofHeight(viewer, property.id, property.longitude, property.latitude, height);
          }
        }
        if (!cancelled && propertyPopupRef.current?.propertyId) {
          updatePopupFromPin(propertyPopupRef.current.propertyId);
        }
      })();
    }

    return () => { cancelled = true; };
    // focusId is deliberately handled by a separate lightweight effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayProperties, mode, status]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewerAlive(viewer) || status === 'error' || status === 'loading') return;
    if (focusId != null || !mappedLocations.length) return;
    fitToPortfolio(viewer, mode, fittedRef.current ? 0.7 : 1.05);
    // Re-frame when the filtered property set changes (fitToken), not on every geocode tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToken, status, mode, focusId]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewerAlive(viewer)) return;
    setActivePin(viewer, focusId);
    if (focusId == null) {
      setPropertyPopup(null);
      return;
    }

    const property = displayProperties.find((item) => item.id === focusId);
    if (!property) return;

    if (property.latitude == null || property.longitude == null) {
      resolveLocation(property);
      return;
    }

    const roofHeight = roofHeightsRef.current.get(property.id);
    flyTo(viewer, property.longitude, property.latitude, {
      range: mode === '3d' ? 520 : undefined,
      pitch: -27,
      heading: 34,
      targetHeight: Number.isFinite(Number(roofHeight)) ? Number(roofHeight) : 55,
      duration: 1.0,
      complete: () => {
        if (viewerAlive(viewer)) openPropertyPopup(property);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, displayProperties]);

  async function runSearch(event) {
    event?.preventDefault();
    const viewer = viewerRef.current;
    if (!viewerAlive(viewer) || !query.trim()) return;
    setSearching(true);
    try {
      const hits = await googleGeocode(viewer, query, TOKEN);
      setSearchResults(hits.slice(0, 6));
    } catch (error) {
      console.warn('Map search failed:', error.message);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function chooseSearchResult(result) {
    const viewer = viewerRef.current;
    const center = destinationCenter(result.destination);
    if (!viewerAlive(viewer) || !center) return;
    setQuery(result.displayName || query);
    setSearchResults([]);
    setCoordinatePopup(null);
    setPropertyPopup(null);
    flyTo(viewer, center.lon, center.lat, {
      range: mode === '3d' ? 760 : undefined,
      pitch: -31,
      heading: 25,
      targetHeight: 35,
      duration: 0.9,
    });
  }

  function toggle(nextMode) {
    const viewer = viewerRef.current;
    if (!viewerAlive(viewer)) return;
    if (nextMode === '3d' && !tilesetRef.current) return;
    setModeState(nextMode);
    setMode(viewer, tilesetRef.current, nextMode);
    setCoordinatePopup(null);

    setTimeout(() => {
      if (!viewerAlive(viewer)) return;
      if (selectedProperty?.latitude != null && selectedProperty?.longitude != null) {
        const roofHeight = roofHeightsRef.current.get(selectedProperty.id);
        flyTo(viewer, selectedProperty.longitude, selectedProperty.latitude, {
          range: nextMode === '3d' ? 520 : undefined,
          pitch: -27,
          heading: 34,
          targetHeight: Number.isFinite(Number(roofHeight)) ? Number(roofHeight) : 55,
          duration: 0.8,
          complete: () => openPropertyPopup(selectedProperty),
        });
      } else {
        fitToPortfolio(viewer, nextMode, 0.85);
      }
    }, 380);
  }

  function resetView() {
    const viewer = viewerRef.current;
    if (viewerAlive(viewer)) {
      setPropertyPopup(null);
      setCoordinatePopup(null);
      fittedRef.current = false;
      fitToPortfolio(viewer, mode, 0.9);
    }
  }

  function clearSelection() {
    setPropertyPopup(null);
    setCoordinatePopup(null);
    setActivePin(viewerRef.current, null);
    onClearSelection?.();
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === shellRef.current) {
        await document.exitFullscreen?.();
      } else {
        await shellRef.current?.requestFullscreen?.();
      }
    } catch (error) {
      console.warn('Fullscreen mode is unavailable:', error.message);
    }
  }

  const showLoading = mode === '3d' && (status === 'loading' || status === 'streaming');

  return (
    <section ref={shellRef} className={`map-card ${isFullscreen ? 'is-fullscreen-map' : ''}`} aria-label="Property map">
      <div ref={containerRef} className="cesium-host" />

      {isFullscreen && (
        <div className="fullscreen-map-titlebar">
          <div>
            <strong>SF Top Leases YTD</strong>
            <span>San Francisco office leasing</span>
          </div>
          <button type="button" className="fullscreen-exit" onClick={toggleFullscreen}>
            <HiOutlineArrowsPointingOut /> Exit full screen
          </button>
        </div>
      )}

      <div className="map-primary-controls">
        <div className="map-mode-switch" role="group" aria-label="Map mode">
          <button className={mode === '2d' ? 'active' : ''} onClick={() => toggle('2d')}>
            <HiOutlineMap /> Map
          </button>
          <button
            className={mode === '3d' ? 'active' : ''}
            onClick={() => toggle('3d')}
            disabled={!tilesetRef.current && status !== 'loading' && status !== 'streaming'}
          >
            <HiOutlineCube /> 3D
          </button>
        </div>
        {!isFullscreen && (
          <button className="map-fullscreen-button" type="button" onClick={toggleFullscreen}>
            <HiOutlineArrowsPointingOut /> Full screen
          </button>
        )}
      </div>

      <div className={`map-toolbar ${searchOpen ? 'search-open' : ''}`}>
        <div className={`map-search ${searchOpen ? 'open' : ''}`}>
          {searchOpen && (
            <form className="map-search-form" onSubmit={runSearch}>
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search an address or place"
                aria-label="Search map"
              />
              {searching && <span className="search-spinner" />}
              {searchResults.length > 0 && (
                <div className="map-search-results">
                  {searchResults.map((result, index) => (
                    <button
                      type="button"
                      key={`${result.displayName || 'result'}-${index}`}
                      onClick={() => chooseSearchResult(result)}
                    >
                      {result.displayName || 'Map result'}
                    </button>
                  ))}
                </div>
              )}
            </form>
          )}
          <button
            className="map-icon-button search-toggle"
            type="button"
            onClick={() => {
              setSearchOpen((open) => !open);
              setSearchResults([]);
            }}
            title="Search map"
            aria-label="Search map"
          >
            <HiOutlineMagnifyingGlass />
          </button>
        </div>

        <button className="map-icon-button map-reset" type="button" onClick={resetView} title="Reset map view" aria-label="Reset map view">
          <HiOutlineHome />
        </button>
        {focusId != null && <button className="map-clear-button" type="button" onClick={clearSelection}>Clear</button>}
      </div>

      {locating && <div className="geocode-chip"><span className="mini-spinner" /> Positioning properties…</div>}

      <PropertyPopup
        property={popupProperty}
        lease={activeLease}
        position={propertyPopup}
        onClose={clearSelection}
      />
      <CoordinatePopup point={coordinatePopup} onClose={() => setCoordinatePopup(null)} />

      {isFullscreen && fullscreenContent}

      {showLoading && (
        <div className="map-loading-skeleton map-streaming">
          <div className="city-loader" aria-label="Loading 3D city">
            <div className="city-loader-bars" aria-hidden="true"><i /><i /><i /><i /><i /></div>
            <strong>{status === 'loading' ? 'Starting 3D city' : 'Refining building detail'}</strong>
            <small>Loading the nearest buildings first, then sharpening the scene.</small>
            <div className="skeleton-progress"><i /></div>
          </div>
        </div>
      )}

      {status === 'fallback' && (
        <div className="map-notice">3D tiles are temporarily unavailable. The interactive 2D map is still ready.</div>
      )}
      {status === 'error' && (
        <div className="map-state error-state">
          <strong>Map could not initialize</strong>
          <small>Check the Cesium token in frontend/.env and refresh the page.</small>
        </div>
      )}
    </section>
  );
}
