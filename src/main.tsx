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
  
  // Test NBA metrics directly
  setTimeout(() => {
    console.log('🧪 Testing NBA metrics directly...');
    try {
      // Import and call NBAAnalyticsMetrics directly
      import('./services/nbaAnalyticsMetrics').then(({ NBAAnalyticsMetrics }) => {
        console.log('🧪 Calling trackFeatureUsage directly...');
        NBAAnalyticsMetrics.trackFeatureUsage('direct_test_feature', { test: true });
        
        console.log('🧪 Calling trackUserSession directly...');
        NBAAnalyticsMetrics.trackUserSession('new', 'test-agent', '1920x1080');
        
        console.log('🧪 Calling trackComparison directly...');
        NBAAnalyticsMetrics.trackComparison('player_vs_player', 'LeBron', 'Curry', '2023-24', '2023-24', 100);
        
        console.log('🧪 All direct NBA metrics calls completed');
      }).catch(error => {
        console.error('🧪 Error importing NBA metrics:', error);
      });
    } catch (error) {
      console.error('🧪 Error with direct NBA metrics:', error);
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