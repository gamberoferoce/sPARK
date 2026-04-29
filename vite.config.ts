import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    // Silence large-chunk warning (aframe-ar bundle is ~3.7MB minified)
    chunkSizeWarningLimit: 5000,
  },
  server: {
    proxy: {
      "/queue-times": {
        target: "https://queue-times.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/queue-times/, ""),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
