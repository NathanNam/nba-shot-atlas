import { useEffect, useRef, useState } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';
import { useAPITracking } from '../hooks/useAPITracking';

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
let coreWebVitalsHistogram: any;
let nbaSpecificMetricsHistogram: any;
let chartRenderingHistogram: any;
let dataVisualizationHistogram: any;

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

    // Enhanced metrics for NBA analytics specific operations
    coreWebVitalsHistogram = meter.createHistogram('core_web_vitals', {
      description: 'Core Web Vitals metrics (LCP, FID, CLS)',
      unit: 'ms',
    });

    nbaSpecificMetricsHistogram = meter.createHistogram('nba_operations_performance', {
      description: 'Performance metrics for NBA-specific operations',
      unit: 'ms',
    });

    chartRenderingHistogram = meter.createHistogram('chart_rendering_performance', {
      description: 'Performance metrics for chart rendering operations',
      unit: 'ms',
    });

    dataVisualizationHistogram = meter.createHistogram('data_visualization_performance', {
      description: 'Performance metrics for data visualization operations',
      unit: 'ms',
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
  const [coreWebVitalsTracked, setCoreWebVitalsTracked] = useState(false);
  const { trackServiceHealth } = useAPITracking();

  // Track Core Web Vitals
  useEffect(() => {
    if (!coreWebVitalsTracked && typeof window !== 'undefined') {
      setCoreWebVitalsTracked(true);
      
      // Track Largest Contentful Paint (LCP)
      if ('PerformanceObserver' in window) {
        try {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            
            if (coreWebVitalsHistogram?.record) {
              coreWebVitalsHistogram.record(lastEntry.startTime, {
                metric: 'lcp',
                component: componentName,
                performance_rating: lastEntry.startTime < 2500 ? 'good' : 
                                  lastEntry.startTime < 4000 ? 'needs_improvement' : 'poor',
              });
            }
            
            safeLog({
              severityNumber: lastEntry.startTime > 4000 ? SeverityNumber.WARN : SeverityNumber.INFO,
              severityText: lastEntry.startTime > 4000 ? 'WARN' : 'INFO',
              body: `LCP measured: ${lastEntry.startTime}ms`,
              attributes: {
                metric: 'largest_contentful_paint',
                value: lastEntry.startTime,
                component: componentName,
                performance_rating: lastEntry.startTime < 2500 ? 'good' : 
                                   lastEntry.startTime < 4000 ? 'needs_improvement' : 'poor',
              },
            });
          });
          
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (error) {
          console.warn('Failed to setup LCP observer:', error);
        }

        // Track First Input Delay (FID)
        try {
          const fidObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry: any) => {
              if (coreWebVitalsHistogram?.record) {
                coreWebVitalsHistogram.record(entry.processingStart - entry.startTime, {
                  metric: 'fid',
                  component: componentName,
                  performance_rating: entry.processingStart - entry.startTime < 100 ? 'good' : 
                                     entry.processingStart - entry.startTime < 300 ? 'needs_improvement' : 'poor',
                });
              }
              
              safeLog({
                severityNumber: (entry.processingStart - entry.startTime) > 300 ? SeverityNumber.WARN : SeverityNumber.INFO,
                severityText: (entry.processingStart - entry.startTime) > 300 ? 'WARN' : 'INFO',
                body: `FID measured: ${entry.processingStart - entry.startTime}ms`,
                attributes: {
                  metric: 'first_input_delay',
                  value: entry.processingStart - entry.startTime,
                  component: componentName,
                  performance_rating: entry.processingStart - entry.startTime < 100 ? 'good' : 
                                     entry.processingStart - entry.startTime < 300 ? 'needs_improvement' : 'poor',
                },
              });
            });
          });
          
          fidObserver.observe({ type: 'first-input', buffered: true });
        } catch (error) {
          console.warn('Failed to setup FID observer:', error);
        }

        // Track Cumulative Layout Shift (CLS)
        try {
          let clsValue = 0;
          const clsObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry: any) => {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            });
            
            if (coreWebVitalsHistogram?.record) {
              coreWebVitalsHistogram.record(clsValue, {
                metric: 'cls',
                component: componentName,
                performance_rating: clsValue < 0.1 ? 'good' : 
                                   clsValue < 0.25 ? 'needs_improvement' : 'poor',
              });
            }
            
            if (clsValue > 0) {
              safeLog({
                severityNumber: clsValue > 0.25 ? SeverityNumber.WARN : SeverityNumber.INFO,
                severityText: clsValue > 0.25 ? 'WARN' : 'INFO',
                body: `CLS measured: ${clsValue}`,
                attributes: {
                  metric: 'cumulative_layout_shift',
                  value: clsValue,
                  component: componentName,
                  performance_rating: clsValue < 0.1 ? 'good' : 
                                     clsValue < 0.25 ? 'needs_improvement' : 'poor',
                },
              });
            }
          });
          
          clsObserver.observe({ type: 'layout-shift', buffered: true });
        } catch (error) {
          console.warn('Failed to setup CLS observer:', error);
        }
      }
    }
  }, [componentName, coreWebVitalsTracked]);

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

// Enhanced utility functions for NBA analytics performance tracking
export function trackNBAOperation(operationName: string, duration: number, dataSize?: number, entityType?: string) {
  if (nbaSpecificMetricsHistogram?.record) {
    nbaSpecificMetricsHistogram.record(duration, {
      operation: operationName,
      entity_type: entityType || 'unknown',
      data_size_category: dataSize ? (dataSize < 100 ? 'small' : dataSize < 1000 ? 'medium' : 'large') : 'unknown',
      performance_rating: duration < 100 ? 'excellent' : duration < 500 ? 'good' : duration < 1000 ? 'acceptable' : 'poor',
    });
  }

  safeLog({
    severityNumber: duration > 1000 ? SeverityNumber.WARN : SeverityNumber.DEBUG,
    severityText: duration > 1000 ? 'WARN' : 'DEBUG',
    body: `NBA operation: ${operationName}`,
    attributes: {
      operation_name: operationName,
      duration_ms: duration,
      data_size: dataSize,
      entity_type: entityType,
      performance_tier: duration < 100 ? 'excellent' : duration < 500 ? 'good' : duration < 1000 ? 'acceptable' : 'poor',
    },
  });
}

export function trackChartRendering(chartType: string, duration: number, dataPoints?: number, isInteractive?: boolean) {
  if (chartRenderingHistogram?.record) {
    chartRenderingHistogram.record(duration, {
      chart_type: chartType,
      data_points_category: dataPoints ? (dataPoints < 100 ? 'small' : dataPoints < 1000 ? 'medium' : 'large') : 'unknown',
      interactive: isInteractive ? 'true' : 'false',
      performance_rating: duration < 100 ? 'excellent' : duration < 300 ? 'good' : duration < 500 ? 'acceptable' : 'poor',
    });
  }

  safeLog({
    severityNumber: duration > 500 ? SeverityNumber.WARN : SeverityNumber.DEBUG,
    severityText: duration > 500 ? 'WARN' : 'DEBUG',
    body: `Chart rendering: ${chartType}`,
    attributes: {
      chart_type: chartType,
      duration_ms: duration,
      data_points: dataPoints,
      interactive: isInteractive,
      performance_tier: duration < 100 ? 'excellent' : duration < 300 ? 'good' : duration < 500 ? 'acceptable' : 'poor',
    },
  });
}

export function trackDataVisualization(visualizationType: string, duration: number, complexity?: 'low' | 'medium' | 'high') {
  if (dataVisualizationHistogram?.record) {
    dataVisualizationHistogram.record(duration, {
      visualization_type: visualizationType,
      complexity: complexity || 'unknown',
      performance_rating: duration < 200 ? 'excellent' : duration < 500 ? 'good' : duration < 1000 ? 'acceptable' : 'poor',
    });
  }

  safeLog({
    severityNumber: duration > 1000 ? SeverityNumber.WARN : SeverityNumber.DEBUG,
    severityText: duration > 1000 ? 'WARN' : 'DEBUG',
    body: `Data visualization: ${visualizationType}`,
    attributes: {
      visualization_type: visualizationType,
      duration_ms: duration,
      complexity: complexity,
      performance_tier: duration < 200 ? 'excellent' : duration < 500 ? 'good' : duration < 1000 ? 'acceptable' : 'poor',
    },
  });
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
