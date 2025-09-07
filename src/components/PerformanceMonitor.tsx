import { useEffect, useRef } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

// Safe logger function that checks if logger is initialized
const safeLog = (logData: any) => {
  if (logger?.emit) {
    logger.emit(logData);
  }
};

// Performance metrics with safe initialization
let pageLoadDuration: any;
let componentRenderDuration: any;
let userInteractionCounter: any;
let performanceObservationCounter: any;
let memoryUsageGauge: any;
let apiResponseTimeHistogram: any;
let componentRerenderCounter: any;
let errorCounter: any;
let userInteractionLatencyHistogram: any;

// Initialize metrics safely
const initMetrics = () => {
  if (meter?.createHistogram) {
    pageLoadDuration = meter.createHistogram('page_load_duration_ms', {
      description: 'Duration of page load events',
    });

    componentRenderDuration = meter.createHistogram('component_render_duration_ms', {
      description: 'Duration of component render cycles',
    });

    userInteractionCounter = meter.createCounter('user_interactions_total', {
      description: 'Total number of user interactions',
    });

    performanceObservationCounter = meter.createCounter('performance_observations_total', {
      description: 'Total number of performance observations',
    });

    memoryUsageGauge = meter.createUpDownCounter('memory_usage_mb', {
      description: 'Current memory usage in megabytes',
    });

    apiResponseTimeHistogram = meter.createHistogram('api_response_time_ms', {
      description: 'API response times in milliseconds',
    });

    componentRerenderCounter = meter.createCounter('component_rerenders_total', {
      description: 'Total number of component rerenders',
    });

    errorCounter = meter.createCounter('errors_total', {
      description: 'Total number of errors encountered',
    });

    userInteractionLatencyHistogram = meter.createHistogram('user_interaction_latency_ms', {
      description: 'Latency from user interaction to response',
    });
  }
};

// Initialize metrics when module loads
initMetrics();

interface PerformanceMonitorProps {
  componentName?: string;
  children: React.ReactNode;
}

export function PerformanceMonitor({ componentName = 'unknown', children }: PerformanceMonitorProps) {
  const renderStartTime = useRef<number>(Date.now());
  const mountTime = useRef<number>(Date.now());
  const renderCount = useRef<number>(0);
  const previousProps = useRef<any>();

  useEffect(() => {
    const span = tracer.startSpan('performance_monitor.component_lifecycle', {
      attributes: {
        'component.name': componentName,
        'performance.event': 'mount',
      },
    });

    try {
      // Record component mount time
      const mountDuration = Date.now() - mountTime.current;
      
      if (componentRenderDuration?.record) {
        componentRenderDuration.record(mountDuration, {
          component_name: componentName,
          lifecycle_event: 'mount',
        });
      }

      safeLog({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: 'Component mounted',
        attributes: {
          component_name: componentName,
          mount_duration_ms: mountDuration,
        },
      });

      span.setAttributes({
        'component.mount_duration_ms': mountDuration,
      });

      // Cleanup function for unmount
      return () => {
        const unmountSpan = tracer.startSpan('performance_monitor.component_unmount', {
          attributes: {
            'component.name': componentName,
            'performance.event': 'unmount',
          },
        });

        try {
          const totalLifetime = Date.now() - mountTime.current;
          
          safeLog({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: 'Component unmounted',
            attributes: {
              component_name: componentName,
              total_lifetime_ms: totalLifetime,
            },
          });

          unmountSpan.setAttributes({
            'component.total_lifetime_ms': totalLifetime,
          });
        } finally {
          unmountSpan.end();
        }
      };
    } finally {
      span.end();
    }
  }, [componentName]);

  // Track render performance and rerenders
  useEffect(() => {
    const renderDuration = Date.now() - renderStartTime.current;
    renderCount.current += 1;
    
    if (componentRenderDuration?.record) {
      componentRenderDuration.record(renderDuration, {
        component_name: componentName,
        lifecycle_event: 'render',
        render_count: renderCount.current.toString(),
      });
    }

    // Track rerenders after initial mount
    if (renderCount.current > 1 && componentRerenderCounter?.add) {
      componentRerenderCounter.add(1, {
        component_name: componentName,
        render_count: renderCount.current.toString(),
      });
    }

    if (renderDuration > 100) { // Log slow renders
      safeLog({
        severityNumber: SeverityNumber.WARN,
        severityText: 'WARN',
        body: 'Slow component render detected',
        attributes: {
          component_name: componentName,
          render_duration_ms: renderDuration,
          render_count: renderCount.current,
          is_rerender: renderCount.current > 1,
        },
      });
    }

    // Debug excessive rerenders
    if (renderCount.current > 10) {
      safeLog({
        severityNumber: SeverityNumber.WARN,
        severityText: 'WARN',
        body: 'Excessive component rerenders detected',
        attributes: {
          component_name: componentName,
          total_renders: renderCount.current,
          average_render_duration: renderDuration,
        },
      });
    }

    // Reset render start time for next render
    renderStartTime.current = Date.now();
  });

  return <>{children}</>;
}

// Utility functions for tracking performance outside of components
export const trackAPIResponse = (apiEndpoint: string, responseTime: number, success: boolean, statusCode?: number) => {
  if (apiResponseTimeHistogram?.record) {
    apiResponseTimeHistogram.record(responseTime, {
      endpoint: apiEndpoint,
      success: success.toString(),
      status_code: statusCode?.toString() || 'unknown',
    });
  }

  if (!success && errorCounter?.add) {
    errorCounter.add(1, {
      error_type: 'api_error',
      endpoint: apiEndpoint,
      status_code: statusCode?.toString() || 'unknown',
    });
  }

  safeLog({
    severityNumber: success ? SeverityNumber.INFO : SeverityNumber.ERROR,
    severityText: success ? 'INFO' : 'ERROR',
    body: success ? 'API request completed' : 'API request failed',
    attributes: {
      endpoint: apiEndpoint,
      response_time_ms: responseTime,
      success,
      status_code: statusCode,
      timestamp: new Date().toISOString(),
    },
  });
};

export const trackUserInteractionLatency = (interactionType: string, latency: number, additionalContext?: Record<string, any>) => {
  if (userInteractionLatencyHistogram?.record) {
    userInteractionLatencyHistogram.record(latency, {
      interaction_type: interactionType,
      ...additionalContext,
    });
  }

  if (latency > 500) { // Log slow interactions
    safeLog({
      severityNumber: SeverityNumber.WARN,
      severityText: 'WARN',
      body: 'Slow user interaction detected',
      attributes: {
        interaction_type: interactionType,
        latency_ms: latency,
        ...additionalContext,
        timestamp: new Date().toISOString(),
      },
    });
  }
};

export const trackError = (errorType: string, errorMessage: string, componentName?: string, additionalContext?: Record<string, any>) => {
  if (errorCounter?.add) {
    errorCounter.add(1, {
      error_type: errorType,
      component_name: componentName || 'unknown',
    });
  }

  safeLog({
    severityNumber: SeverityNumber.ERROR,
    severityText: 'ERROR',
    body: errorMessage,
    attributes: {
      error_type: errorType,
      component_name: componentName,
      ...additionalContext,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    },
  });
};

// Global performance monitoring setup
export function setupGlobalPerformanceMonitoring() {
  const span = tracer.startSpan('performance_monitor.setup_global_monitoring');

  try {
    // Monitor page load performance
    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => {
        const loadSpan = tracer.startSpan('performance_monitor.page_load');
        
        try {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          
          if (navigation) {
            const loadTime = navigation.loadEventEnd - navigation.fetchStart;
            const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
            const firstPaint = performance.getEntriesByName('first-paint')[0]?.startTime || 0;
            const firstContentfulPaint = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0;

            if (pageLoadDuration?.record) {
              pageLoadDuration.record(loadTime, { event_type: 'load' });
              pageLoadDuration.record(domContentLoaded, { event_type: 'dom_content_loaded' });
              
              if (firstPaint > 0) {
                pageLoadDuration.record(firstPaint, { event_type: 'first_paint' });
              }
              
              if (firstContentfulPaint > 0) {
                pageLoadDuration.record(firstContentfulPaint, { event_type: 'first_contentful_paint' });
              }
            }

            safeLog({
              severityNumber: SeverityNumber.INFO,
              severityText: 'INFO',
              body: 'Page load performance metrics',
              attributes: {
                load_time_ms: loadTime,
                dom_content_loaded_ms: domContentLoaded,
                first_paint_ms: firstPaint,
                first_contentful_paint_ms: firstContentfulPaint,
                url: window.location.href,
              },
            });

            loadSpan.setAttributes({
              'page.load_time_ms': loadTime,
              'page.dom_content_loaded_ms': domContentLoaded,
              'page.first_paint_ms': firstPaint,
              'page.first_contentful_paint_ms': firstContentfulPaint,
              'page.url': window.location.href,
            });
          }
        } finally {
          loadSpan.end();
        }
      });

      // Monitor user interactions
      ['click', 'keydown', 'scroll', 'resize'].forEach(eventType => {
        window.addEventListener(eventType, (event) => {
          if (userInteractionCounter?.add) {
            userInteractionCounter.add(1, {
              interaction_type: eventType,
              target_tag: (event.target as Element)?.tagName?.toLowerCase() || 'unknown',
            });
          }
        }, { passive: true });
      });

      // Monitor memory usage periodically
      if ('memory' in performance) {
        const monitorMemory = () => {
          const memory = (performance as any).memory;
          if (memory) {
            const usedMB = memory.usedJSHeapSize / 1024 / 1024;
            const totalMB = memory.totalJSHeapSize / 1024 / 1024;
            
            if (memoryUsageGauge?.add) {
              memoryUsageGauge.add(usedMB, { memory_type: 'used' });
              memoryUsageGauge.add(totalMB, { memory_type: 'total' });
            }

            // Log high memory usage
            if (usedMB > 100) {
              safeLog({
                severityNumber: SeverityNumber.WARN,
                severityText: 'WARN',
                body: 'High memory usage detected',
                attributes: {
                  used_memory_mb: usedMB,
                  total_memory_mb: totalMB,
                  memory_usage_percentage: (usedMB / totalMB) * 100,
                },
              });
            }
          }
        };

        // Monitor memory every 30 seconds
        setInterval(monitorMemory, 30000);
        monitorMemory(); // Initial measurement
      }

      // Monitor long tasks
      if ('PerformanceObserver' in window) {
        try {
          const longTaskObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              if (performanceObservationCounter?.add) {
                performanceObservationCounter.add(1, { observation_type: 'long_task' });
              }
              
              safeLog({
                severityNumber: SeverityNumber.WARN,
                severityText: 'WARN',
                body: 'Long task detected',
                attributes: {
                  task_duration_ms: entry.duration,
                  task_start_time: entry.startTime,
                },
              });
            });
          });
          
          longTaskObserver.observe({ entryTypes: ['longtask'] });
        } catch (error) {
          safeLog({
            severityNumber: SeverityNumber.WARN,
            severityText: 'WARN',
            body: 'Failed to setup long task observer',
            attributes: {
              error: (error as Error).message,
            },
          });
        }
      }

      safeLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Global performance monitoring setup completed',
        attributes: {
          user_agent: navigator.userAgent,
          url: window.location.href,
        },
      });
    }
  } finally {
    span.end();
  }
}
