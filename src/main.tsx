import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DataPreloader } from "@/services/dataPreloader";
import App from "./App";
import "./index.css";

// Initialize OpenTelemetry
import "./otel-client";

// Start preloading default data immediately
DataPreloader.preloadDefaultData().then(() => {
  console.log('🚀 Default data preloading completed');
}).catch(error => {
  console.error('🚀 Error preloading default data:', error);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);