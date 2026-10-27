import process from 'node:process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      allowedHosts: true,
      // When VITE_API_BASE_URL is empty, the frontend calls same-origin /api and Vite forwards it to the backend.
      proxy: { '/api': { target: env.BACKEND_PROXY_TARGET || 'http://localhost:8000', changeOrigin: true } },
    },
  };
});
