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
      '/api': 'http://localhost:4000',
    },
  },
});
