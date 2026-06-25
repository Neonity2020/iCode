import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { LandingPage } from "./LandingPage";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <LandingPage />
  </StrictMode>,
);
