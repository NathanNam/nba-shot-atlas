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
  
  // Test NBA metrics directly - ensure they get created
  setTimeout(() => {
    console.log('🧪 Starting NBA metrics test...');
    
    // Use dynamic import to ensure everything is ready
    import('./services/nbaAnalyticsMetrics').then(({ NBAAnalyticsMetrics }) => {
      console.log('🧪 NBA metrics module imported successfully');
      
      try {
        console.log('🧪 Test 1: trackFeatureUsage');
        NBAAnalyticsMetrics.trackFeatureUsage('direct_test_feature', { test: true, timestamp: Date.now() });
        
        console.log('🧪 Test 2: trackUserSession');
        NBAAnalyticsMetrics.trackUserSession('new', 'Mozilla/5.0 test-agent', '1920x1080');
        
        console.log('🧪 Test 3: trackComparison');
        NBAAnalyticsMetrics.trackComparison('player_vs_player', 'LeBron James', 'Stephen Curry', '2023-24', '2023-24', 150);
        
        console.log('🧪 All NBA metric tests completed successfully');
      } catch (error) {
        console.error('🧪 Error calling NBA metrics:', error);
      }
    }).catch(error => {
      console.error('🧪 Error importing NBA metrics module:', error);
    });
  }, 2000);
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