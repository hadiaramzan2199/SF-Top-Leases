# Netlify deployment — SF Top Leases YTD 2

This repository is prepared to deploy the Vite/React frontend and the Express API on **one Netlify site**. Supabase remains the hosted database.

## Architecture

- Frontend: `frontend/` → Vite build → `frontend/dist`
- API: `backend/src/app.js` → `backend/netlify/functions/api.js`
- Database: Supabase
- Routing: `/api/*` is rewritten to the Netlify Function

## Do not commit local `.env` files

The repository `.gitignore` excludes `frontend/.env` and `backend/.env`.
Use `frontend/.env.example` and `backend/.env.example` as references only.

## Netlify environment variables

Add these under **Project configuration → Environment variables**:

### Required frontend variable

- `VITE_CESIUM_ION_TOKEN` — your current Cesium ion browser token

### Required backend variables

- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key; server-side only

### Optional after the first deploy

- `CLIENT_ORIGIN` — your final Netlify site URL, for example `https://your-site.netlify.app`

Do not set `VITE_API_BASE_URL` in Netlify for this single-site deployment. The frontend will call `/api/...` on the same domain.

If your Cesium ion token has URL/domain restrictions enabled, add the final Netlify domain to the token's allowed URLs; otherwise the 3D tiles can work locally but fail on the deployed site.

## Netlify build settings

The root `netlify.toml` already configures:

- Build command: installs frontend/backend packages and builds Vite
- Publish directory: `frontend/dist`
- Functions directory: `backend/netlify/functions`
- Node.js 20
- `/api/*` rewrite to the Express Netlify Function
- SPA fallback to `index.html`

When importing the GitHub repository into Netlify, leave the **Base directory blank / repository root** and allow `netlify.toml` to provide the build settings.

## Verify after deployment

Open:

`https://YOUR-SITE.netlify.app/api/health`

Expected response contains:

```json
{"ok":true,"service":"sf-top-leases-ytd-api"}
```

Then test the dashboard and one CRUD update in Property Manager and refresh the page to verify the change persisted in Supabase.

## Local development

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```


## Node version
This project uses Node 22 for Netlify builds because the current Cesium dependency requires Node 22 or newer.
