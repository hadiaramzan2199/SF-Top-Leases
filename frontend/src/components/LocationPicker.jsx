import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import {
  createViewer,
  addPhotorealistic,
  setMode,
  flyTo,
  screenToLonLat,
  googleGeocode,
  destinationCenter,
  viewerAlive,
} from '../lib/cesium.js';

const TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN;
const pinBuilder = new Cesium.PinBuilder();

export default function LocationPicker({ value, onChange }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const tilesetRef = useRef(null);
  const pinRef = useRef(null);
  const draggingRef = useRef(false);
  const latestAddressRef = useRef(value?.address || '');

  const [query, setQuery] = useState(value?.address || '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [mapStatus, setMapStatus] = useState('loading');
  const [coords, setCoords] = useState(
    value?.lat != null && value?.lon != null ? { lat: value.lat, lon: value.lon } : null,
  );

  useEffect(() => { latestAddressRef.current = value?.address || ''; }, [value?.address]);

  useEffect(() => {
    let disposed = false;
    let tileReadyCleanup = null;
    let readyTimer = null;
    const viewer = createViewer(containerRef.current, TOKEN, { compact: true });
    viewerRef.current = viewer;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((event) => {
      if (draggingRef.current) return;
      const picked = viewer.scene.pick(event.position);
      if (picked?.id === pinRef.current) return;
      const ll = screenToLonLat(viewer, event.position);
      if (ll) placePin(ll.lon, ll.lat, true);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((event) => {
      const picked = viewer.scene.pick(event.position);
      if (picked?.id === pinRef.current) {
        draggingRef.current = true;
        viewer.scene.screenSpaceCameraController.enableInputs = false;
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    handler.setInputAction((event) => {
      if (!draggingRef.current || !pinRef.current) return;
      const ll = screenToLonLat(viewer, event.endPosition);
      if (!ll) return;
      pinRef.current.position = Cesium.Cartesian3.fromDegrees(ll.lon, ll.lat);
      publish(ll.lon, ll.lat);
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    handler.setInputAction(() => {
      draggingRef.current = false;
      if (viewerAlive(viewer)) viewer.scene.screenSpaceCameraController.enableInputs = true;
    }, Cesium.ScreenSpaceEventType.LEFT_UP);

    if (value?.lat != null && value?.lon != null) {
      placePin(value.lon, value.lat, false);
      flyTo(viewer, value.lon, value.lat, 700);
    }

    addPhotorealistic(viewer).then((tileset) => {
      if (disposed || !viewerAlive(viewer)) return;
      tilesetRef.current = tileset;
      if (!tileset) {
        setMode(viewer, null, '2d');
        setMapStatus('ready');
        return;
      }
      setMode(viewer, tileset, '3d');
      setMapStatus('streaming');
      const ready = () => {
        if (!disposed) setMapStatus('ready');
        if (readyTimer) clearTimeout(readyTimer);
      };
      tileReadyCleanup = tileset.initialTilesLoaded?.addEventListener(ready) || null;
      readyTimer = setTimeout(ready, 7000);
    });

    return () => {
      disposed = true;
      tileReadyCleanup?.();
      if (readyTimer) clearTimeout(readyTimer);
      if (!handler.isDestroyed()) handler.destroy();
      if (viewerAlive(viewer)) viewer.destroy();
      viewerRef.current = null;
      pinRef.current = null;
    };
    // Initialize this imperative Cesium viewer only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function publish(lon, lat, address = latestAddressRef.current) {
    setCoords({ lon, lat });
    onChange?.({ lat, lon, address });
  }

  function placePin(lon, lat, emit = true, address = latestAddressRef.current) {
    const viewer = viewerRef.current;
    if (!viewerAlive(viewer)) return;
    if (pinRef.current) viewer.entities.remove(pinRef.current);

    pinRef.current = viewer.entities.add({
      id: 'location-picker-pin',
      position: Cesium.Cartesian3.fromDegrees(Number(lon), Number(lat)),
      billboard: {
        image: pinBuilder.fromColor(Cesium.Color.fromCssColorString('#2f80ed'), 48).toDataURL(),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: Cesium.HeightReference.CLAMP_TO_3D_TILE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    setCoords({ lon: Number(lon), lat: Number(lat) });
    if (emit) publish(Number(lon), Number(lat), address);
  }

  async function search() {
    if (!query.trim() || !viewerAlive(viewerRef.current)) return;
    setSearching(true);
    try {
      const hits = await googleGeocode(viewerRef.current, query, TOKEN);
      setResults(hits.slice(0, 5));
    } catch (error) {
      console.error('Google geocoder search failed:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function choose(result) {
    const center = destinationCenter(result.destination);
    if (!center) return;
    const address = result.displayName || query;
    latestAddressRef.current = address;
    setQuery(address);
    setResults([]);
    flyTo(viewerRef.current, center.lon, center.lat, 650);
    placePin(center.lon, center.lat, true, address);
  }

  return (
    <div className="location-picker">
      <div className="picker-search-row">
        <div className="picker-query">
          <input
            placeholder="Search an address, e.g. 300 Howard St, San Francisco"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                search();
              }
            }}
          />
          {results.length > 0 && (
            <div className="picker-results">
              {results.map((result, index) => (
                <button key={`${result.displayName}-${index}`} type="button" onClick={() => choose(result)}>
                  <strong>{result.displayName}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" className="btn secondary" onClick={search} disabled={searching}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </div>

      <div className="picker-map-shell">
        <div ref={containerRef} className="picker-map" />
        {mapStatus !== 'ready' && (
          <div className="picker-map-loading">
            <span className="mini-spinner" />
            <strong>{mapStatus === 'streaming' ? 'Loading 3D buildings…' : 'Preparing map…'}</strong>
          </div>
        )}
        <div className="picker-hint">Click a building or drag the blue pin to fine-tune</div>
      </div>

      <div className="coordinate-readout">
        <span className={`coordinate-state ${coords ? 'set' : ''}`} />
        {coords
          ? `Selected location · ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`
          : 'No location selected yet'}
      </div>
    </div>
  );
}
