import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.webp"],
      manifest: {
        name: "Eulesia",
        short_name: "Eulesia",
        description: "Eurooppalainen kansalaisdemokratia-alusta",
        start_url: "/agora",
        display: "standalone",
        background_color: "#1e3a8a",
        theme_color: "#1e3a8a",
        orientation: "portrait-primary",
        icons: [
          { src: "/icons/icon-48.webp", sizes: "48x48", type: "image/webp" },
          { src: "/icons/icon-72.webp", sizes: "72x72", type: "image/webp" },
          { src: "/icons/icon-96.webp", sizes: "96x96", type: "image/webp" },
          { src: "/icons/icon-128.webp", sizes: "128x128", type: "image/webp" },
          {
            src: "/icons/icon-192.webp",
            sizes: "192x192",
            type: "image/webp",
            purpose: "any",
          },
          { src: "/icons/icon-256.webp", sizes: "256x256", type: "image/webp" },
          {
            src: "/icons/icon-512.webp",
            sizes: "512x512",
            type: "image/webp",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        importScripts: ["/sw-push.js"],
        globPatterns: ["**/*.{js,css,html,svg,webp,woff,woff2}"],
        // Activate new SW immediately — don't wait for all tabs to close
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Cache locale files
            urlPattern: /\/locales\/.*\.json$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "eulesia-locales",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Cache API responses (short TTL, network-first)
            urlPattern: /\/api\/v1\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 5 },
              networkTimeoutSeconds: 10,
            },
          },
        ],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React + router
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Data fetching
          "vendor-data": ["@tanstack/react-query"],
          // i18n
          "vendor-i18n": [
            "i18next",
            "react-i18next",
            "i18next-http-backend",
            "i18next-browser-languagedetector",
          ],
          // Map
          "vendor-map": ["leaflet", "react-leaflet", "react-leaflet-cluster"],
          // Icons
          "vendor-icons": ["lucide-react"],
          // Sanitization
          "vendor-sanitize": ["dompurify"],
        },
      },
    },
  },
});
