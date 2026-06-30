import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { getDevPort } from "../scripts/dev-config.mjs";

export default defineConfig({
  plugins: react(),
  server: {
    host: "127.0.0.1",
    port: getDevPort("marketing"),
    strictPort: true,
  },
  build: {
    outDir: "dist",
  },
});
