import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  const serverEnv = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/analyzer-api/api/analysis': {
          target: serverEnv.ANALYZER_URL || 'http://localhost:8090',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/analyzer-api/, ''),
          proxyTimeout: 35_000,
          headers: { Authorization: `Bearer ${serverEnv.ANALYZER_API_KEY || ''}` },
        },
        '/stream-api': {
          target: serverEnv.STREAM_URL || 'http://localhost:18082',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/stream-api/, ''),
          proxyTimeout: 35_000,
        },
        '/api/internet-accounts': {
          target: process.env.VITE_AUTH_BACKEND_URL || 'http://localhost:8082',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api\/internet-accounts/, '/admin/internet-accounts'),
          headers: process.env.AUTH_ADMIN_TOKEN
            ? {Authorization: `Bearer ${process.env.AUTH_ADMIN_TOKEN}`}
            : undefined,
        },
        '/api': {
          target: process.env.VITE_BACKEND_URL || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  };
});
