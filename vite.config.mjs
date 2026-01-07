// vite.config.mjs
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const domain = env.VITE_PUBLIC_DOMAIN || "localhost";

  return {
    plugins: [react()],

    server: {
      host: true,
      port: 5173,
      hmr: {
        protocol: domain === "localhost" ? "ws" : "wss",
        host: domain,
        clientPort: domain === "localhost" ? 5173 : 443,
      },
    },

    preview: {
      port: 8080,
    },
  };
});
