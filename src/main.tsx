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
      // Test various NBA metric types
      MetricsIntegration.trackFeature('app_initialization_fixed', { timestamp: Date.now() });
      MetricsIntegration.trackContentEngagement('shot_chart', 'player', 'LeBron James', '2023-24', 5000);
      MetricsIntegration.trackComparison('player_vs_player', 'LeBron James', 'Stephen Curry', '2023-24');
      MetricsIntegration.trackShotChartInteraction('click', {
        entityName: 'LeBron James',
        entityType: 'player',
        season: '2023-24',
        shotCount: 1250
      });
      console.log('🧪 All NBA metrics should now appear in Observe');
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