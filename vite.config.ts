import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['FullLogo.png'],
      manifest: {
        name: 'AydQuoteMaker - Professional Quotation Maker',
        short_name: 'AydQuoteMaker',
        description: 'Create, save and share professional quotes from anywhere — works fully offline.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#D4AF37',
        background_color: '#0A0A0A',
        categories: ['business', 'finance', 'productivity'],
        prefer_related_applications: false,
        icons: [
          {
            src: '/FullLogo.png',
            type: 'image/png',
            sizes: '192x192',
            purpose: 'any',
          },
          {
            src: '/FullLogo.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  server: {
    port: 5000,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/admin-zw': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/admin-assets': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        format: 'es',
      },
    },
  },
});
