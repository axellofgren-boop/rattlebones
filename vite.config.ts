import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative paths so the build works from any hosting sub-folder (e.g. GitHub Pages).
  base: './',
  // Three.js alone is ~500 kB unminified (130 kB gzipped); that's expected for a 3D game.
  build: { target: 'es2020', chunkSizeWarningLimit: 800 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Rattlebones',
        short_name: 'Rattlebones',
        description: 'A goofy skeleton versus endless hordes. Survive, level up, build something ridiculous.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#2a1f3d',
        theme_color: '#2a1f3d',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cache everything so the game works offline after the first visit.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
      },
    }),
  ],
});
