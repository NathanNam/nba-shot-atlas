import { useEffect, useRef } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';
import { useCoreWebVitals } from '../hooks/useCoreWebVitals';

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
let dataLoadingDuration: any;
let apiCallDuration: any;
let cacheHitCounter: any;
let errorCounter: any;
let componentMountCounter: any;
let renderPerformanceHistogram: any;

// Initialize metrics safely
const initMetrics = () => {
  if (meter?.createHistogram) {
    pageLoadDuration = meter.createHistogram('page_load_duration_ms', {
      description: 'Duration of page load events',
      unit: 'ms',
    });

    componentRenderDuration = meter.createHistogram('component_render_duration_ms', {
      description: 'Duration of component render cycles',
      unit: 'ms',
    });

    renderPerformanceHistogram = meter.createHistogram('component_render_performance', {
      description: 'Component render performance metrics with percentiles',
      unit: 'ms',
    });

    dataLoadingDuration = meter.createHistogram('data_loading_duration_ms', {
      description: 'Time taken to load NBA data (API calls, caching, processing)',
      unit: 'ms',
    });

    apiCallDuration = meter.createHistogram('api_call_duration_ms', {
      description: 'Duration of external API calls',
      unit: 'ms',
    });

    userInteractionCounter = meter.createCounter('user_interactions_total', {
      description: 'Total number of user interactions',
    });

    performanceObservationCounter = meter.createCounter('performance_observations_total', {
      description: 'Total number of performance observations',
    });

    cacheHitCounter = meter.createCounter('cache_operations_total', {
      description: 'Cache hits and misses for data operations',
    });

    errorCounter = meter.createCounter('errors_total', {
      description: 'Total number of errors by type and component',
    });

    componentMountCounter = meter.createCounter('component_mounts_total', {
      description: 'Total number of component mounts by component type',
    });

    memoryUsageGauge = meter.createUpDownCounter('memory_usage_mb', {
      description: 'Current memory usage in megabytes',
      unit: 'MB',
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
  
  // Integrate Core Web Vitals monitoring
  const { metrics: webVitalsMetrics, getOverallScore } = useCoreWebVitals();

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

      if (componentMountCounter?.add) {
        componentMountCounter.add(1, {
          component_name: componentName,
          mount_type: 'initial',
        });
      }

      if (renderPerformanceHistogram?.record) {
        renderPerformanceHistogram.record(mountDuration, {
          component: componentName,
          event_type: 'mount',
          performance_tier: mountDuration < 50 ? 'fast' : mountDuration < 200 ? 'normal' : 'slow',
        });
      }

      safeLog({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: 'Component mounted',
        attributes: {
          component_name: componentName,
          mount_duration_ms: mountDuration,
          web_vitals_score: getOverallScore(),
          web_vitals_metrics: webVitalsMetrics,
        },
      });

      span.setAttributes({
        'component.mount_duration_ms': mountDuration,
        'webvitals.overall_score': getOverallScore(),
        'webvitals.cls': webVitalsMetrics.cls || 0,
        'webvitals.fid': webVitalsMetrics.fid || 0,
        'webvitals.lcp': webVitalsMetrics.lcp || 0,
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

  // Track render performance
  useEffect(() => {
    const renderDuration = Date.now() - renderStartTime.current;
    
    if (componentRenderDuration?.record) {
      componentRenderDuration.record(renderDuration, {
        component_name: componentName,
        lifecycle_event: 'render',
      });
    }

    if (renderPerformanceHistogram?.record) {
      renderPerformanceHistogram.record(renderDuration, {
        component: componentName,
        event_type: 'render',
        performance_tier: renderDuration < 16 ? 'fast' : renderDuration < 50 ? 'normal' : 'slow',
        frame_budget_met: renderDuration < 16 ? 'true' : 'false', // 60fps budget
      });
    }

    // Log slow renders with more context
    if (renderDuration > 50) { // Lowered threshold for better monitoring
      if (errorCounter?.add) {
        errorCounter.add(1, {
          error_type: 'slow_render',
          component_name: componentName,
          severity: renderDuration > 100 ? 'high' : 'medium',
        });
      }

      safeLog({
        severityNumber: renderDuration > 100 ? SeverityNumber.WARN : SeverityNumber.INFO,
        severityText: renderDuration > 100 ? 'WARN' : 'INFO',
        body: renderDuration > 100 ? 'Slow component render detected' : 'Component render above 60fps budget',
        attributes: {
          component_name: componentName,
          render_duration_ms: renderDuration,
          frame_budget_exceeded: renderDuration > 16,
          performance_impact: renderDuration > 100 ? 'high' : 'medium',
          url: typeof window !== 'undefined' ? window.location.href : '',
        },
      });
    }
  });

  return <>{children}</>;
}

// Utility functions for performance tracking
export function trackDataLoading(operationName: string, duration: number, cacheHit: boolean = false, dataSize?: number) {
  if (dataLoadingDuration?.record) {
    dataLoadingDuration.record(duration, {
      operation: operationName,
      cache_hit: cacheHit ? 'true' : 'false',
      data_size_category: dataSize ? (dataSize < 1000 ? 'small' : dataSize < 10000 ? 'medium' : 'large') : 'unknown',
    });
  }

  if (cacheHitCounter?.add) {
    cacheHitCounter.add(1, {
      operation: operationName,
      result: cacheHit ? 'hit' : 'miss',
    });
  }

  safeLog({
    severityNumber: duration > 2000 ? SeverityNumber.WARN : SeverityNumber.DEBUG,
    severityText: duration > 2000 ? 'WARN' : 'DEBUG',
    body: `Data loading operation: ${operationName}`,
    attributes: {
      operation_name: operationName,
      duration_ms: duration,
      cache_hit: cacheHit,
      data_size: dataSize,
      performance_tier: duration < 500 ? 'fast' : duration < 2000 ? 'normal' : 'slow',
    },
  });
}

export function trackApiCall(apiEndpoint: string, duration: number, statusCode?: number, errorMessage?: string) {
  if (apiCallDuration?.record) {
    apiCallDuration.record(duration, {
      endpoint: apiEndpoint,
      status_code: statusCode ? statusCode.toString() : 'unknown',
      success: (!errorMessage && (!statusCode || statusCode < 400)) ? 'true' : 'false',
    });
  }

  if (errorMessage && errorCounter?.add) {
    errorCounter.add(1, {
      error_type: 'api_error',
      endpoint: apiEndpoint,
      status_code: statusCode?.toString() || 'unknown',
    });
  }

  safeLog({
    severityNumber: errorMessage ? SeverityNumber.ERROR : duration > 5000 ? SeverityNumber.WARN : SeverityNumber.DEBUG,
    severityText: errorMessage ? 'ERROR' : duration > 5000 ? 'WARN' : 'DEBUG',
    body: `API call: ${apiEndpoint}`,
    attributes: {
      api_endpoint: apiEndpoint,
      duration_ms: duration,
      status_code: statusCode,
      error_message: errorMessage,
      performance_tier: duration < 1000 ? 'fast' : duration < 5000 ? 'normal' : 'slow',
    },
  });
}

export function trackComponentError(componentName: string, errorMessage: string, errorStack?: string) {
  if (errorCounter?.add) {
    errorCounter.add(1, {
      error_type: 'component_error',
      component_name: componentName,
    });
  }

  safeLog({
    severityNumber: SeverityNumber.ERROR,
    severityText: 'ERROR',
    body: `Component error in ${componentName}`,
    attributes: {
      component_name: componentName,
      error_message: errorMessage,
      error_stack: errorStack,
      url: typeof window !== 'undefined' ? window.location.href : '',
      timestamp: new Date().toISOString(),
    },
  });
}

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

      // Enhanced memory monitoring with leak detection
      if ('memory' in performance) {
        let previousMemoryReadings: number[] = [];
        let memoryTrendCounter = 0;
        
        const monitorMemory = () => {
          const memory = (performance as any).memory;
          if (memory) {
            const usedMB = memory.usedJSHeapSize / 1024 / 1024;
            const totalMB = memory.totalJSHeapSize / 1024 / 1024;
            
            // Track memory readings for leak detection
            previousMemoryReadings.push(usedMB);
            if (previousMemoryReadings.length > 10) {
              previousMemoryReadings.shift(); // Keep only last 10 readings
            }

            if (memoryUsageGauge?.add) {
              memoryUsageGauge.add(usedMB, { memory_type: 'used' });
              memoryUsageGauge.add(totalMB, { memory_type: 'total' });
            }

            // Enhanced memory leak detection
            if (previousMemoryReadings.length >= 5) {
              const averageGrowth = previousMemoryReadings.reduce((acc, curr, index) => {
                if (index === 0) return 0;
                return acc + (curr - previousMemoryReadings[index - 1]);
              }, 0) / (previousMemoryReadings.length - 1);

              // Detect consistent memory growth (potential leak)
              if (averageGrowth > 2 && usedMB > 50) { // Growing by 2MB+ per interval
                memoryTrendCounter++;
                
                if (memoryTrendCounter >= 3) { // Consistent trend over 3 intervals
                  safeLog({
                    severityNumber: SeverityNumber.ERROR,
                    severityText: 'ERROR',
                    body: 'Potential memory leak detected',
                    attributes: {
                      used_memory_mb: usedMB,
                      total_memory_mb: totalMB,
                      average_growth_mb: averageGrowth,
                      memory_readings: previousMemoryReadings,
                      trend_counter: memoryTrendCounter,
                      memory_usage_percentage: (usedMB / totalMB) * 100,
                    },
                  });
                  
                  memoryTrendCounter = 0; // Reset to avoid spam
                }
              } else {
                memoryTrendCounter = Math.max(0, memoryTrendCounter - 1);
              }
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
                  memory_trend: averageGrowth > 0 ? 'growing' : 'stable',
                },
              });
            }
          }
        };

        // Monitor memory every 15 seconds for better leak detection
        setInterval(monitorMemory, 15000);
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
