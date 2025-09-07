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
  MetricsIntegration.initialize();
  
  // Test the fixed NBA metrics
  setTimeout(() => {
    console.log('🧪 Testing fixed NBA metrics...');
    try {
      MetricsIntegration.trackFeature('app_initialization_fixed', { timestamp: Date.now() });
      console.log('🧪 NBA feature metric should now work');
    } catch (error) {
      console.error('🧪 Error with fixed NBA metrics:', error);
    }
  }, 1500);
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