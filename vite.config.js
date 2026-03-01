import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'WebSquare — Safari Inventory Management',
        short_name: 'WebSquare',
        description: 'Inventory management for safari lodges and bush camps. Stock, procurement, kitchen, bar and dispatch — works offline.',
        start_url: './',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#f59e0b',
        orientation: 'portrait-primary',
        icons: [
          { src: './favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: './icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: './icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Google Fonts — cache for 1 year
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
          {
            // API calls — network-first with 5s timeout, fall back to cache
            // Note: api.js already handles IndexedDB caching for fine-grained control
            urlPattern: /^https:\/\/darkblue-goshawk-672880\.hostingersite\.com/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-responses',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
            },
          },
        ],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  base: './',
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'https://darkblue-goshawk-672880.hostingersite.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      }
    }
  }
})
