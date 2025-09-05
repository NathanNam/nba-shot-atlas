import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DataPreloader } from "@/services/dataPreloader";
import App from "./App";
import "./index.css";

// Force clear caches first
import "./utils/forceCacheClear";

// Initialize OpenTelemetry
import "./otel-client";

// Start preloading default data immediately - but after cache clear
setTimeout(() => {
  DataPreloader.preloadDefaultData().then(() => {
    console.log('🚀 Default data preloading completed');
  }).catch(error => {
    console.error('🚀 Error preloading default data:', error);
  });
}, 200);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);