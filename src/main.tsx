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
  
  // Force trigger NBA metrics to test them
  setTimeout(() => {
    console.log('🧪 Testing NBA metrics after OTEL init...');
    try {
      MetricsIntegration.trackFeature('app_initialization', { timestamp: Date.now() });
      console.log('🧪 NBA feature metric triggered');
      
      // Track a test page view
      MetricsIntegration.trackPageView();
      console.log('🧪 NBA page view tracked');
    } catch (error) {
      console.error('🧪 Error triggering NBA metrics:', error);
    }
  }, 1000); // Wait 1 second to ensure OTEL is fully ready
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