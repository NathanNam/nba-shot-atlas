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

// Environment configuration
const ENV = {
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mode: import.meta.env.MODE,
  viteEnv: import.meta.env,
};

// Enhanced initialization with environment-aware configuration and fallbacks
async function initializeApplication() {
  const appStartTime = performance.now();
  console.log(`🏀 Initializing NBA Analytics App in ${ENV.mode} mode...`);
  
  try {
    // Initialize OpenTelemetry with environment-specific config
    const otelConfig = {
      serviceName: 'nba-analytics-webapp',
      version: '1.0.0',
      environment: ENV.mode,
      debug: ENV.isDevelopment,
      // In development, use higher sampling rates for more data
      traceSampleRate: ENV.isDevelopment ? 1.0 : 0.1,
      // In production, use batch processing for efficiency
      enableBatchProcessing: ENV.isProduction,
      // Only enable instrumentation in production by default
      enableInstrumentation: ENV.isProduction || ENV.viteEnv.VITE_ENABLE_TELEMETRY === 'true',
    };

    // Initialize OTEL with graceful fallback
    let otelInitialized = false;
    let metricsInitialized = false;
    
    try {
      // Set environment-specific configuration for otel-client to use
      (window as any).__OTEL_CONFIG__ = otelConfig;
      
      await initOtel();
      otelInitialized = true;
      console.log('✅ OpenTelemetry initialized successfully');
      
      try {
        // Initialize NBA Analytics metrics tracking
        MetricsIntegration.initialize();
        metricsInitialized = true;
        console.log('📊 NBA Analytics metrics integration initialized');
      } catch (metricsError) {
        console.warn('⚠️ NBA Analytics metrics initialization failed, continuing without enhanced metrics:', metricsError);
      }
    } catch (otelError) {
      console.warn('⚠️ OpenTelemetry initialization failed, continuing without telemetry:', otelError);
    }

    // Log initialization success/failure status
    const initializationStatus = {
      openTelemetryEnabled: otelInitialized,
      metricsIntegrationEnabled: metricsInitialized,
      environment: ENV.mode,
      debug: ENV.isDevelopment,
      instrumentationEnabled: otelConfig.enableInstrumentation,
      initializationTime: performance.now() - appStartTime,
    };

    console.log('🔧 Application initialization status:', initializationStatus);

    // Store initialization status for runtime access
    (window as any).__NBA_ANALYTICS_CONFIG__ = {
      ...initializationStatus,
      version: '1.0.0',
      buildTime: new Date().toISOString(),
      viteEnv: ENV.viteEnv,
    };

    return initializationStatus;

  } catch (error) {
    console.error('❌ Critical error during application initialization:', error);
    
    // Still proceed with app launch even if telemetry fails
    const fallbackStatus = {
      openTelemetryEnabled: false,
      metricsIntegrationEnabled: false,
      environment: ENV.mode,
      debug: ENV.isDevelopment,
      instrumentationEnabled: false,
      initializationTime: performance.now() - appStartTime,
      error: (error as Error).message,
    };

    (window as any).__NBA_ANALYTICS_CONFIG__ = {
      ...fallbackStatus,
      version: '1.0.0',
      buildTime: new Date().toISOString(),
      viteEnv: ENV.viteEnv,
    };

    return fallbackStatus;
  }
}

// Initialize application with error handling
initializeApplication().then((status) => {
  if (ENV.isDevelopment) {
    console.log('🚀 Application initialization completed:', status);
  }
}).catch(error => {
  console.error('❌ Fatal error during application initialization:', error);
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