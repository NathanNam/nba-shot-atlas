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
  
  // Create a simple NBA metric test that should work immediately
  setTimeout(() => {
    console.log('🧪 Testing NBA metrics with direct import...');
    try {
      // Import the class directly and call a method
      import('./services/nbaAnalyticsMetrics').then(({ NBAAnalyticsMetrics }) => {
        console.log('🧪 About to call trackFeatureUsage...');
        NBAAnalyticsMetrics.trackFeatureUsage('direct_test', { test: true });
        console.log('🧪 Direct NBA metric call completed');
      });
    } catch (error) {
      console.error('🧪 Error with direct NBA metrics:', error);
    }
  }, 1500); // Wait longer to ensure OTEL is ready
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