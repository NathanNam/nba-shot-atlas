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

// Global error handlers for unhandled errors
if (typeof window !== 'undefined') {
  // Set up global error boundary
  window.addEventListener('error', (event) => {
    console.error('🚨 Unhandled Error:', event.error);
    // Error will be handled by useErrorTracking hook's global handlers
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled Promise Rejection:', event.reason);
    // Error will be handled by useErrorTracking hook's global handlers
  });
  
  // Add development mode helpers
  if (process.env.NODE_ENV === 'development') {
    (window as any).__NBA_ANALYTICS_DEBUG__ = {
      sessionInfo: () => ({
        sessionId: sessionStorage.getItem('sessionId'),
        sessionStartTime: sessionStorage.getItem('sessionStartTime'),
        sessionDuration: Date.now() - parseInt(sessionStorage.getItem('sessionStartTime') || '0'),
      }),
      performanceInfo: () => ({
        memory: (performance as any).memory ? {
          used: Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024)) + 'MB',
          total: Math.round((performance as any).memory.totalJSHeapSize / (1024 * 1024)) + 'MB',
          limit: Math.round((performance as any).memory.jsHeapSizeLimit / (1024 * 1024)) + 'MB',
        } : 'Not available',
        timing: performance.timing ? {
          loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart + 'ms',
          domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart + 'ms',
        } : 'Not available',
      }),
      clearSession: () => {
        sessionStorage.removeItem('sessionId');
        sessionStorage.removeItem('sessionStartTime');
        console.log('Session data cleared');
      },
    };
    
    console.log('🔧 Development mode: Access __NBA_ANALYTICS_DEBUG__ for debugging tools');
  }
}

// Initialize OTEL and metrics asynchronously with comprehensive error handling
initOtel().then(() => {
  console.log('✅ OpenTelemetry initialized successfully');
  
  // Initialize NBA Analytics metrics tracking
  MetricsIntegration.initialize();
  
  // Set session start time for tracking
  if (typeof window !== 'undefined') {
    (window as any).sessionStartTime = Date.now();
    sessionStorage.setItem('sessionStartTime', Date.now().toString());
    sessionStorage.setItem('sessionId', `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    
    // Track application startup
    console.log('🏀 NBA Analytics Dashboard initialized with comprehensive observability');
    console.log('📊 Available hooks: useComponentPerformance, useErrorTracking, useNBAAnalyticsTracking');
    console.log('🔧 Services: NBAService (enhanced), NBAAnalyticsMetrics, ErrorBoundary (enhanced)');
    console.log('📈 Monitoring: Core Web Vitals, Memory Leak Detection, Performance Tracking');
  }
}).catch(error => {
  console.error('❌ Failed to initialize OpenTelemetry:', error);
  
  // Initialize fallback session tracking even if OTEL fails
  if (typeof window !== 'undefined') {
    (window as any).sessionStartTime = Date.now();
    sessionStorage.setItem('sessionStartTime', Date.now().toString());
    sessionStorage.setItem('sessionId', `fallback_session_${Date.now()}`);
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

// Enhanced root rendering with error boundary
const container = document.getElementById("root");
if (!container) {
  throw new Error('Root container not found');
}

const root = createRoot(container);

// Render with comprehensive error handling
try {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  
  console.log('🏀 NBA Analytics Dashboard rendered successfully');
} catch (error) {
  console.error('❌ Failed to render app:', error);
  
  // Fallback rendering
  root.render(
    <div style={{
      padding: '20px',
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <h1>🏀 NBA Analytics Dashboard</h1>
      <p style={{ color: '#ef4444' }}>Failed to initialize the application.</p>
      <p>Please refresh the page or contact support if the issue persists.</p>
      <button 
        onClick={() => window.location.reload()}
        style={{
          padding: '8px 16px',
          marginTop: '16px',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Reload Page
      </button>
    </div>
  );
}