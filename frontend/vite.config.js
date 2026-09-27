import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
import tailwindcss from '@tailwindcss/vite';

// vite-plugin-cesium copies Cesium's static Assets/Workers/Widgets and sets
// CESIUM_BASE_URL automatically — this is the piece people usually get wrong.
export default defineConfig({
  plugins: [react(), cesium(), tailwindcss()],
  appType: 'spa',
  server: {
    port: 5173,
    proxy: {
      // Frontend calls /api/* -> forwarded to the Express backend.
      // The backend's routes no longer include the '/api' prefix (that prefix
      // is stripped by Netlify's Functions runtime in production), so the
      // dev proxy must strip it here too, to match.
      '/api': {
        target: 'http://localhost:4000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
