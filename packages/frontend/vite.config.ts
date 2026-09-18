/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const allowedHosts = (process.env.VITE_ALLOWED_HOSTS || process.env.FRONTEND_HOST || '')
  .split(',')
  .map((host) => host.trim())
  .map((host) => host.replace(/^https?:\/\//, '').split('/')[0])
  .filter(Boolean);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: [],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@oxedindin/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
  preview: {
    port: 5173,
    host: true,
    allowedHosts,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
          charts: ['recharts'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 10000,
  },
});