import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'

const gitCommit = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
})()

const gitCommitDate = (() => {
  try {
    return execSync('git log -1 --format=%cI', { encoding: 'utf-8' }).trim()
  } catch {
    return ''
  }
})()

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
    __GIT_COMMIT_DATE__: JSON.stringify(gitCommitDate),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png', 'android-chrome-192x192.png', 'android-chrome-512x512.png', 'icons.svg'],
      manifest: {
        name: 'OPTCG Lib',
        short_name: 'OPTCG Lib',
        description: 'offline first one piece card game library',
        id: '/',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        screenshots: [
          { src: '/og-image.png', sizes: '1200x630', type: 'image/png', form_factor: 'wide', label: 'OPTCG Lib card browser' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,wasm,db}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024, // 12MB for the wasm/DB
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/serveproxy\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-images',
              cacheableResponse: {
                statuses: [0, 200],
              },
              expiration: {
                maxEntries: 5000,
                maxAgeSeconds: 180 * 24 * 60 * 60, // 180 days (~6 months)
              },
            },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    include: ['sql.js'],
  },
})
