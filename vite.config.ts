import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// APERCU=1 : version sans service worker, avec des chemins relatifs (aperçu hébergé)
const apercu = process.env.APERCU === '1'

export default defineConfig({
  base: apercu ? './' : '/',
  plugins: [
    react(),
    !apercu &&
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Affluence — salles de Grenoble',
        short_name: 'Affluence',
        description: 'L’affluence en direct dans les salles de sport de Grenoble.',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#FFF9ED',
        theme_color: '#2B2118',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 500 } },
          },
        ],
      },
    }),
  ],
})
