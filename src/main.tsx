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

// Initialize OTEL and metrics asynchronously with enhanced error handling
initOtel().then((otelComponents) => {
  console.log('✅ OpenTelemetry initialized successfully');
  console.log('📊 Available components:', {
    tracer: !!otelComponents.tracer,
    logger: !!otelComponents.logger,
    meter: !!otelComponents.meter,
  });
  
  // Initialize NBA Analytics metrics tracking
  MetricsIntegration.initialize();
  
  // Log successful initialization
  otelComponents.logger.emit({
    severityNumber: 1, // INFO
    severityText: 'INFO',
    body: 'NBA Analytics application started successfully',
    attributes: {
      app_version: '1.0.0',
      environment: import.meta.env.MODE,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${screen.width}x${screen.height}`,
      online: navigator.onLine,
      connection: (navigator as any).connection?.effectiveType || 'unknown',
    },
  });
}).catch(error => {
  console.error('❌ Failed to initialize OpenTelemetry:', error);
  
  // Still try to initialize metrics integration with fallback
  try {
    MetricsIntegration.initialize();
    console.log('⚠️  Fallback metrics initialized without OpenTelemetry');
  } catch (fallbackError) {
    console.error('❌ Complete metrics initialization failure:', fallbackError);
  }
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