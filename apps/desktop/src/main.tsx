import { App, PlatformProvider } from "@icode/app";
import "@icode/app/styles.css";
import type { ICodePlatformApi } from "@icode/platform";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

declare global {
  interface Window {
    icode?: ICodePlatformApi;
  }
}

const api = window.icode;
if (!api) throw new Error("iCode desktop preload bridge is unavailable");

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <PlatformProvider api={api}>
      <App />
    </PlatformProvider>
  </StrictMode>,
);
