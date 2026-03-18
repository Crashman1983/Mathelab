import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { sharedConfig } from "./vite.config";

// PWA build: Separate Dateien + Service Worker für Offline-Fähigkeit
export default defineConfig({
  ...sharedConfig,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: false, // Nutze public/manifest.json direkt
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
        // Cache alles für vollständige Offline-Fähigkeit
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
