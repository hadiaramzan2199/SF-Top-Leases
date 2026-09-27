# SF Top Leases YTD 2

GIS-based San Francisco office lease intelligence application with a Property Manager workflow.

## Stack

- React 18 + Vite
- CesiumJS with Google Photorealistic 3D Tiles
- Node.js + Express
- Supabase / PostgreSQL
- Recharts

## Run locally

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

The supplied `frontend/.env` and `backend/.env` are already present. Keep the project private because backend environment configuration contains privileged Supabase credentials.

## Dashboard behavior

- Compact white report-style UI based on the supplied SF Top Leases reference.
- Map-first layout with the former dashboard title strip removed to maximize Cesium space.
- 2D + Google Photorealistic 3D modes.
- Custom icon-first Google/Cesium map search; the search field expands only when requested.
- Light-blue building markers sit on sampled roof heights where Google 3D Tiles provide a surface; the selected property uses a larger dark-blue marker. Markers fade/disappear with distance to reduce clutter.
- Selecting a comp, timeline point, or map marker flies to an oblique building view, highlights the location, and opens a compact property popup beside the building.
- The selected-property popup is anchored to the selected Cesium entity and follows that building while the user pans, tilts, or zooms the map.
- Clicking any non-property point on the map opens a latitude/longitude popup for that location.
- Missing property coordinates are geocoded through the Cesium/Google geocoder and persisted back to Supabase.
- Google Photorealistic tiles use a faster initial quality followed by a sharper screen-space error after first load, plus a lightweight animated skyline loader while details stream.
- Required Cesium ion / Google Maps attribution remains visible in a compact presentation.
- Timeline and Market Stats remain synchronized with the comp list and map.
- Full-screen map mode includes FieldSet-style Market Stats / Timeline tabs in a floating insight panel.
- A Clear action removes the current building selection without resetting the whole dashboard.

## Property Manager

The Property Manager supports properties, leases, and sale transactions. Property coordinates are chosen through an interactive map instead of manually typing latitude/longitude.

The `Prepared By` field is intentionally not part of the application.

---

## Netlify deployment

This version is prepared for a **single Netlify site**:

```text
React / Vite frontend (Netlify static site)
              ↓ /api/*
Express API (Netlify Function)
              ↓
Supabase PostgreSQL
```

Deployment support files included in the repository:

- `netlify.toml`
- `.nvmrc`
- `backend/src/app.js`
- `backend/netlify/functions/api.js`
- `NETLIFY_DEPLOYMENT.md`

The local `.env` files are intentionally ignored by Git. Add the production environment variables in Netlify instead. See `NETLIFY_DEPLOYMENT.md` for the exact steps and variables.
