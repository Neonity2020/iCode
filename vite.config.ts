import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { getDevPort } from "./scripts/dev-config.mjs";

function devPortHtmlPlugin() {
  const devPort = String(getDevPort());
  return {
    name: "dev-port-html",
    transformIndexHtml(html: string) {
      return html.replaceAll("__DEV_PORT__", devPort);
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), devPortHtmlPlugin()],
  server: {
    host: "127.0.0.1",
    port: getDevPort(),
    strictPort: true,
  },
  build: {
    outDir: "dist",
  },
});
