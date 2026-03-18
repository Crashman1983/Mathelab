import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { sharedConfig } from "./vite.config";

// Base-URL aus Umgebungsvariable — wird in CI für GitHub Pages gesetzt.
// Lokal: "/" (Standard), CI: "/Mathelab/pwa/"
const base = process.env.VITE_BASE_URL ?? "/";

// PWA build: Separate Dateien + Service Worker für Offline-Fähigkeit
export default defineConfig({
  ...sharedConfig,
  base,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      includeAssets: ["favicon.svg", "icons/*.png"],
      // Manifest inline — Pfade relativ zur base (statt public/manifest.json mit hardcodierten /-Pfaden)
      manifest: {
        name: "Mathewerkstatt Bayern 3/4",
        short_name: "Mathewerkstatt",
        description: "Interaktive Mathematik für die Grundschule",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "any",
        theme_color: "#0F1B2D",
        background_color: "#0F1B2D",
        lang: "de",
        categories: ["education", "kids"],
        icons: [
          { src: `${base}icons/icon-192.png`,        sizes: "192x192",  type: "image/png" },
          { src: `${base}icons/icon-512.png`,        sizes: "512x512",  type: "image/png" },
          { src: `${base}icons/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: `${base}favicon.svg`,               sizes: "any",      type: "image/svg+xml" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    ...sharedConfig.build,
    outDir: "dist-pwa",
  },
});
