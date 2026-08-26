import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: false,
      },
      includeAssets: ["favicon.ico", "pwa-192x192.png", "pwa-512x512.png"],
      manifest: {
        name: "Shop Manager Pro",
        short_name: "ShopManager",
        description: "Workshop management for your print shop",
        theme_color: "#0284c7",
        background_color: "#edf2f7",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // 'html' intentionally excluded: generateSW auto-registers a
        // precache-bound NavigationRoute for index.html as soon as it's in
        // the precache manifest, and that route always wins over any
        // runtimeCaching rule below for the same request — the NetworkFirst
        // navigation rule was silently unreachable while it was included.
        // The origin already serves index.html correctly (verified: no-cache,
        // must-revalidate, and correct SPA fallback for deep links like
        // /action-items) so the SW doesn't need to own navigation fallback.
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        // vite-plugin-pwa defaults this to "index.html" via `??` whenever
        // it's not set at all, which re-registers the same precache-bound
        // NavigationRoute this config is trying to avoid — an explicit
        // `undefined` wouldn't survive that (nullish-coalescing treats it the
        // same as absent), but an empty string does: it's not nullish, so it
        // passes through, and workbox-build's template only emits the
        // NavigationRoute when navigateFallback is truthy.
        navigateFallback: "",
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Navigations (page loads/reloads) go network-first instead of
            // serving a cached app shell. Without this, a normal reload could
            // keep rendering an old build until the background update-check +
            // reload cycle catches up — a cycle Safari in particular is slow
            // and unreliable about completing. This app shows live shop data,
            // where a stale UI is actively misleading, so freshness wins over
            // offline navigation; falls back to the cached shell only if the
            // network genuinely doesn't respond in time.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 4,
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
