import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DataPreloader } from "@/services/dataPreloader";
import App from "./App";
import "./index.css";

// Force clear caches first
import "./utils/forceCacheClear";

// Initialize OpenTelemetry
import { initOtel } from "./otel-client";
import { MetricsIntegration } from "./services/metricsIntegration";

// Initialize OTEL and metrics asynchronously
initOtel().then(({ tracer, logger, meter }) => {
  console.log('✅ OpenTelemetry initialized successfully');
  console.log('✅ OTEL Components ready:', { tracer: !!tracer, logger: !!logger, meter: !!meter });
  
  // Initialize NBA Analytics metrics tracking
  console.log('🎯 Initializing NBA Analytics Metrics...');
  MetricsIntegration.initialize();
  console.log('🎯 NBA Analytics Metrics initialization called');
  
  // Test NBA metrics immediately to verify they work
  setTimeout(() => {
    console.log('🧪 Testing NBA metrics...');
    MetricsIntegration.trackFeature('test_feature', { test: true });
    console.log('🧪 NBA test metrics triggered');
  }, 200);
}).catch(error => {
  console.error('❌ Failed to initialize OpenTelemetry:', error);
});

// Preloading disabled for now to troubleshoot caching issues
// setTimeout(() => {
//   DataPreloader.preloadDefaultData().then(() => {
//     console.log('🚀 Default data preloading completed');
//   }).catch(error => {
//     console.error('🚀 Error preloading default data:', error);
//   });
// }, 200);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);