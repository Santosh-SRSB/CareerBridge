import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxies any request the browser makes to /api/* over to the backend
// running on port 4000, so the frontend code can just call fetch("/api/...")
// without worrying about the backend's exact URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
