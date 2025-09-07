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
  
  // Test all NBA metrics to populate Observe
  setTimeout(() => {
    console.log('🧪 Testing all NBA metrics...');
    try {
      console.log('🧪 Testing trackFeature...');
      MetricsIntegration.trackFeature('app_initialization_fixed', { timestamp: Date.now() });
      
      console.log('🧪 Testing trackContentEngagement...');
      const startTime = Date.now() - 5000; // 5 seconds ago
      MetricsIntegration.trackContentEngagement('shot_chart', 'player', 'LeBron James', '2023-24', startTime);
      
      console.log('🧪 Testing trackComparison...');
      MetricsIntegration.trackComparison('player_vs_player', 'LeBron James', 'Stephen Curry', '2023-24');
      
      console.log('🧪 Testing trackShotChartInteraction...');
      MetricsIntegration.trackShotChartInteraction('click', {
        entityName: 'LeBron James',
        entityType: 'player',
        season: '2023-24',
        shotCount: 1250
      });
      
      console.log('🧪 All NBA metrics tests completed');
    } catch (error) {
      console.error('🧪 Error with NBA metrics:', error);
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