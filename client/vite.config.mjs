// vite.config.mjs
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const domain = env.VITE_PUBLIC_DOMAIN || "localhost";

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'Melopra',
          short_name: 'Melopra',
          description: 'Seamless Music Streaming Platform',
          theme_color: '#0b0b0f',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // LAWFUL CACHING: Only intercepts native/proxy audio streams
              // Ignore YouTube iframe streams completely.
              urlPattern: ({ url }) => url.pathname.startsWith('/api/stream') || url.pathname.endsWith('.mp3'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'melopra-native-audio-cache',
                expiration: {
                  maxEntries: 50, // Keep last 50 native songs offline
                  maxAgeSeconds: 60 * 60 * 24 * 7 // Keep for 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],

    server: {
      host: true,
      port: 5173,
      hmr: {
        protocol: domain === "localhost" ? "ws" : "wss",
        host: domain,
        clientPort: domain === "localhost" ? 5173 : 443,
      },
      proxy: {
        // Forward all /api requests to the Express backend during development
        "/api": {
          target: "http://localhost:4000",
          changeOrigin: true,
          secure: false,
        },
        "/proxy": {
          target: "http://localhost:4000",
          changeOrigin: true,
          secure: false,
        },
      },
    },

    preview: {
      port: 8080,
    },
  };
});
