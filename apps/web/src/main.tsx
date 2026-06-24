import { App, PlatformProvider } from "@icode/app";
import "@icode/app/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { webPlatform } from "./platform";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <PlatformProvider api={webPlatform}>
      <App />
    </PlatformProvider>
  </StrictMode>,
);
