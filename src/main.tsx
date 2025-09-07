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
  
  // Set global meter for NBA metrics
  import('./otel-client').then(({ setGlobalMeter }) => {
    setGlobalMeter(meter);
    console.log('✅ Global meter set for NBA metrics');
  });
  
  // Initialize NBA Analytics metrics tracking
  MetricsIntegration.initialize();
  
  // Test NBA metrics immediately using the same pattern as the working nba_test_metric
  console.log('🧪 Testing NBA metrics using the working meter...');
  
  // Create NBA metrics directly using the working meter (same as nba_test_metric)
  const nbaUserSessionsCounter = meter.createCounter('nba_user_sessions_total', {
    description: 'Total number of user sessions tracked'
  });
  
  const nbaFeatureUsageCounter = meter.createCounter('nba_feature_usage_total', {
    description: 'Total number of feature usage events tracked'
  });
  
  const nbaComparisonsCounter = meter.createCounter('nba_comparisons_total', {
    description: 'Total number of comparison operations tracked'
  });
  
  // Emit test data for each counter (same pattern as nba_test_metric)
  console.log('🧪 Emitting NBA counter data...');
  nbaUserSessionsCounter.add(1, { session_type: 'new', test: 'true' });
  nbaFeatureUsageCounter.add(1, { feature: 'otel_ready_test', test: 'true' });
  nbaComparisonsCounter.add(1, { comparison_type: 'player_vs_player', test: 'true' });
  
  console.log('🧪 NBA metrics test data emitted successfully');
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