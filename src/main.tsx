import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Telemetry (src/otel-client.ts, src/services/metricsIntegration.ts) is switched
// off for now: nothing imports it, so it isn't downloaded or sent.

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
