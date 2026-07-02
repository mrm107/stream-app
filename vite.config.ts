import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Go API has no CORS middleware, so instead of calling :8080 from the
// browser we proxy same-origin: the frontend calls /api/... and Vite forwards
// it to the backend, stripping the /api prefix. In production put both behind
// one reverse proxy (Traefik/Nginx) with the same rule.
//
// HLS is proxied the same way: the player fetches /hls/<channelId>.m3u8 (and
// its .ts segments) same-origin, and Vite forwards to the SRS HTTP server on
// :8085/live. This sidesteps CORS between the app (:5173) and SRS (:8085). In
// production, point /hls at your CDN / SRS origin instead.
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
      "/hls": {
        target: process.env.VITE_HLS_TARGET || "http://localhost:8085/live",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hls/, ""),
      },
    },
  },
});
