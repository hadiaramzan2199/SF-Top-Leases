/**
 * One-time geocoder: fills latitude/longitude for any property that is missing them,
 * so the 61 seeded comps appear on the map. Uses OpenStreetMap Nominatim (no API key).
 *
 * Nominatim usage policy: max 1 request/second, and a real User-Agent is required.
 * Run once with:  npm run geocode
 */
import { supabase } from '../src/supabase.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(address) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
    encodeURIComponent(address);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PropertyManager/1.0 (local dev)' },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const json = await res.json();
  if (!json.length) return null;
  return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) };
}

async function run() {
  const { data: rows, error } = await supabase
    .from('properties')
    .select('id, address')
    .is('latitude', null);
  if (error) throw error;

  console.log(`Geocoding ${rows.length} properties…`);
  for (const p of rows) {
    try {
      const hit = await geocode(p.address);
      if (hit) {
        await supabase
          .from('properties')
          .update({ latitude: hit.lat, longitude: hit.lon })
          .eq('id', p.id);
        console.log(`  #${p.id}  ${p.address}  ->  ${hit.lat}, ${hit.lon}`);
      } else {
        console.log(`  #${p.id}  ${p.address}  ->  NOT FOUND`);
      }
    } catch (e) {
      console.log(`  #${p.id}  ${p.address}  ->  ERROR ${e.message}`);
    }
    await sleep(1100); // respect the 1 req/sec policy
  }
  console.log('Done.');
  process.exit(0);
}

run();
