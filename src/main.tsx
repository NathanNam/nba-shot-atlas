import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { DataPreloader } from "@/services/dataPreloader";
import App from "./App";
import "./index.css";

// Force clear caches first
import "./utils/forceCacheClear";

// Initialize OpenTelemetry
import { initOtel, tracer, logger } from "./otel-client";

// Application startup span
const startupSpan = tracer.startSpan('application.startup', {
  attributes: {
    'app.name': 'hoops-analytics-viz',
    'app.version': '1.0.0',
    'app.environment': import.meta.env.MODE,
    'app.url': window.location.href,
    'app.timestamp': new Date().toISOString(),
  },
});

// Initialize OTEL with comprehensive error handling
initOtel()
  .then(({ tracer, logger, meter }) => {
    startupSpan.setAttributes({
      'otel.initialization': 'success',
      'otel.tracer_available': !!tracer,
      'otel.logger_available': !!logger,
      'otel.meter_available': !!meter,
    });

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: '✅ OpenTelemetry initialized successfully',
      attributes: {
        initialization_time: Date.now(),
        environment: import.meta.env.MODE,
        url: window.location.href,
        user_agent: navigator.userAgent,
        trace_id: startupSpan.spanContext().traceId,
        span_id: startupSpan.spanContext().spanId,
      },
    });

    console.log('✅ OpenTelemetry initialized successfully');
    
    // Start rendering the app
    renderApp();
    
    // Optionally enable data preloading in production/staging
    if (import.meta.env.MODE === 'production' || import.meta.env.MODE === 'staging') {
      const preloadSpan = tracer.startSpan('application.data_preload', {
        attributes: {
          'preload.trigger': 'startup',
          'preload.environment': import.meta.env.MODE,
        },
      });

      setTimeout(() => {
        DataPreloader.preloadDefaultData()
          .then(() => {
            preloadSpan.setAttributes({
              'preload.success': true,
            });
            
            logger.emit({
              severityNumber: SeverityNumber.INFO,
              severityText: 'INFO',
              body: '🚀 Default data preloading completed',
              attributes: {
                preload_success: true,
                trace_id: preloadSpan.spanContext().traceId,
                span_id: preloadSpan.spanContext().spanId,
              },
            });
            
            console.log('🚀 Default data preloading completed');
            preloadSpan.setStatus({ code: SpanStatusCode.OK });
          })
          .catch(error => {
            preloadSpan.recordException(error);
            preloadSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: `Data preloading failed: ${error.message}`,
            });
            
            logger.emit({
              severityNumber: SeverityNumber.ERROR,
              severityText: 'ERROR',
              body: '🚀 Error preloading default data',
              attributes: {
                preload_success: false,
                error_message: error.message,
                error_name: error.name,
                trace_id: preloadSpan.spanContext().traceId,
                span_id: preloadSpan.spanContext().spanId,
              },
            });
            
            console.error('🚀 Error preloading default data:', error);
          })
          .finally(() => {
            preloadSpan.end();
          });
      }, 500); // Increased delay to ensure app is fully loaded
    }
  })
  .catch(error => {
    startupSpan.recordException(error);
    startupSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: `OpenTelemetry initialization failed: ${error.message}`,
    });
    
    // Fallback logging when OTel fails
    console.error('❌ Failed to initialize OpenTelemetry:', error);
    
    // Still attempt to start the app even if OTel fails
    renderApp();
  })
  .finally(() => {
    startupSpan.end();
  });

// Render function with error handling
function renderApp() {
  const renderSpan = tracer.startSpan('application.render', {
    attributes: {
      'react.mode': 'StrictMode',
      'react.version': '18',
    },
  });

  try {
    const rootElement = document.getElementById("root");
    
    if (!rootElement) {
      throw new Error('Root element not found');
    }

    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    renderSpan.setAttributes({
      'render.success': true,
    });

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'React application rendered successfully',
      attributes: {
        render_success: true,
        trace_id: renderSpan.spanContext().traceId,
        span_id: renderSpan.spanContext().spanId,
      },
    });

    renderSpan.setStatus({ code: SpanStatusCode.OK });

  } catch (error) {
    renderSpan.recordException(error as Error);
    renderSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: `App rendering failed: ${(error as Error).message}`,
    });

    logger.emit({
      severityNumber: SeverityNumber.FATAL,
      severityText: 'FATAL',
      body: 'Critical error: Failed to render React application',
      attributes: {
        render_success: false,
        error_message: (error as Error).message,
        error_name: (error as Error).name,
        trace_id: renderSpan.spanContext().traceId,
        span_id: renderSpan.spanContext().spanId,
      },
    });

    console.error('💥 Critical error rendering app:', error);
    
    // Show fallback error UI
    document.body.innerHTML = `
      <div style="padding: 2rem; font-family: system-ui; text-align: center;">
        <h1 style="color: #dc2626;">🏀 NBA Analytics - Application Error</h1>
        <p>Failed to load the application. Please refresh the page.</p>
        <button onclick="window.location.reload()" style="
          padding: 0.5rem 1rem; 
          background: #3b82f6; 
          color: white; 
          border: none; 
          border-radius: 0.25rem; 
          cursor: pointer;
          margin-top: 1rem;
        ">Reload Page</button>
        ${import.meta.env.MODE === 'development' ? `
          <details style="margin-top: 2rem; text-align: left;">
            <summary>Error Details (Development)</summary>
            <pre style="background: #f3f4f6; padding: 1rem; border-radius: 0.25rem; overflow: auto;">
              ${(error as Error).message}
              
              ${(error as Error).stack}
            </pre>
          </details>
        ` : ''}
      </div>
    `;

    throw error;
  } finally {
    renderSpan.end();
  }
}

// Start rendering after OTel initialization
// (renderApp is called in the promise chain above)