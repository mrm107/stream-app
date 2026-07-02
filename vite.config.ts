import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Go API has no CORS middleware, so instead of calling :8080 from the
// browser we proxy same-origin: the frontend calls /api/... and Vite forwards
// it to the backend, stripping the /api prefix. In production put both behind
// one reverse proxy (Traefik/Nginx) with the same rule.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:8080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
