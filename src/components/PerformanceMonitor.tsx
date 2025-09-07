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
    // Setup Core Web Vitals monitoring
    setupCoreWebVitalsMonitoring();
    
    // Setup memory leak detection
    setupMemoryLeakDetection();
    
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

// Core Web Vitals metrics
const coreWebVitalsHistogram = meter.createHistogram('core_web_vitals_score', {
  description: 'Core Web Vitals performance scores',
});

const layoutShiftGauge = meter.createUpDownCounter('cumulative_layout_shift_score', {
  description: 'Cumulative Layout Shift scores',
});

const inputDelayHistogram = meter.createHistogram('first_input_delay_ms', {
  description: 'First Input Delay measurements',
  unit: 'ms',
});

const largestContentfulPaintHistogram = meter.createHistogram('largest_contentful_paint_ms', {
  description: 'Largest Contentful Paint measurements',
  unit: 'ms',
});

// Memory leak detection
const memoryLeakCounter = meter.createCounter('memory_leaks_detected_total', {
  description: 'Total number of potential memory leaks detected',
});

const memoryGrowthRate = meter.createHistogram('memory_growth_rate_mb_per_minute', {
  description: 'Rate of memory growth in MB per minute',
  unit: 'MB/min',
});

// Core Web Vitals monitoring
function setupCoreWebVitalsMonitoring() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return;
  }

  try {
    // Monitor Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry;
      
      if (lastEntry) {
        const lcp = lastEntry.startTime;
        
        largestContentfulPaintHistogram.record(lcp, {
          performance_grade: lcp <= 2500 ? 'good' : lcp <= 4000 ? 'needs_improvement' : 'poor',
          page_type: getPageType(),
        });
        
        coreWebVitalsHistogram.record(lcp, {
          metric: 'lcp',
          grade: lcp <= 2500 ? 'good' : lcp <= 4000 ? 'needs_improvement' : 'poor',
        });
        
        safeLog({
          severityNumber: lcp > 4000 ? SeverityNumber.WARN : SeverityNumber.INFO,
          severityText: lcp > 4000 ? 'WARN' : 'INFO',
          body: 'Largest Contentful Paint measured',
          attributes: {
            lcp_ms: lcp,
            lcp_grade: lcp <= 2500 ? 'good' : lcp <= 4000 ? 'needs_improvement' : 'poor',
            page_type: getPageType(),
            url: window.location.href,
          },
        });
      }
    });
    
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    // Monitor First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        const fid = entry.processingStart - entry.startTime;
        
        inputDelayHistogram.record(fid, {
          performance_grade: fid <= 100 ? 'good' : fid <= 300 ? 'needs_improvement' : 'poor',
          interaction_type: entry.name,
        });
        
        coreWebVitalsHistogram.record(fid, {
          metric: 'fid',
          grade: fid <= 100 ? 'good' : fid <= 300 ? 'needs_improvement' : 'poor',
        });
        
        safeLog({
          severityNumber: fid > 300 ? SeverityNumber.WARN : SeverityNumber.DEBUG,
          severityText: fid > 300 ? 'WARN' : 'DEBUG',
          body: 'First Input Delay measured',
          attributes: {
            fid_ms: fid,
            fid_grade: fid <= 100 ? 'good' : fid <= 300 ? 'needs_improvement' : 'poor',
            interaction_type: entry.name,
            url: window.location.href,
          },
        });
      });
    });
    
    fidObserver.observe({ type: 'first-input', buffered: true });

    // Monitor Cumulative Layout Shift (CLS)
    let clsValue = 0;
    let clsEntries: any[] = [];
    
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          clsEntries.push(entry);
        }
      });
      
      layoutShiftGauge.add(clsValue, {
        performance_grade: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs_improvement' : 'poor',
        page_type: getPageType(),
      });
      
      coreWebVitalsHistogram.record(clsValue, {
        metric: 'cls',
        grade: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs_improvement' : 'poor',
      });
      
      if (clsValue > 0.1) {
        safeLog({
          severityNumber: clsValue > 0.25 ? SeverityNumber.WARN : SeverityNumber.INFO,
          severityText: clsValue > 0.25 ? 'WARN' : 'INFO',
          body: 'Cumulative Layout Shift detected',
          attributes: {
            cls_score: clsValue,
            cls_grade: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs_improvement' : 'poor',
            shift_count: clsEntries.length,
            page_type: getPageType(),
            url: window.location.href,
          },
        });
      }
    });
    
    clsObserver.observe({ type: 'layout-shift', buffered: true });
    
  } catch (error) {
    safeLog({
      severityNumber: SeverityNumber.WARN,
      severityText: 'WARN',
      body: 'Failed to setup Core Web Vitals monitoring',
      attributes: {
        error: (error as Error).message,
      },
    });
  }
}

// Memory leak detection system
function setupMemoryLeakDetection() {
  if (typeof window === 'undefined' || !('memory' in performance)) {
    return;
  }

  let memoryHistory: Array<{ timestamp: number; used: number; total: number; }> = [];
  
  const checkMemoryUsage = () => {
    try {
      const memory = (performance as any).memory;
      if (!memory) return;
      
      const now = Date.now();
      const usedMB = memory.usedJSHeapSize / (1024 * 1024);
      const totalMB = memory.totalJSHeapSize / (1024 * 1024);
      const limitMB = memory.jsHeapSizeLimit / (1024 * 1024);
      
      memoryHistory.push({ timestamp: now, used: usedMB, total: totalMB });
      
      // Keep only last 20 measurements
      if (memoryHistory.length > 20) {
        memoryHistory.shift();
      }
      
      // Calculate memory growth rate
      if (memoryHistory.length >= 2) {
        const timeDiffMinutes = (now - memoryHistory[0].timestamp) / (1000 * 60);
        const memoryDiffMB = usedMB - memoryHistory[0].used;
        const growthRate = timeDiffMinutes > 0 ? memoryDiffMB / timeDiffMinutes : 0;
        
        memoryGrowthRate.record(Math.max(0, growthRate), {
          memory_pressure: usedMB / limitMB > 0.8 ? 'high' : usedMB / limitMB > 0.6 ? 'medium' : 'low',
          page_type: getPageType(),
        });
        
        // Detect potential memory leaks
        if (growthRate > 5 || usedMB > limitMB * 0.8) {
          memoryLeakCounter.add(1, {
            leak_type: growthRate > 5 ? 'growth_rate' : 'high_usage',
            severity: usedMB > limitMB * 0.9 ? 'critical' : 'warning',
          });
          
          safeLog({
            severityNumber: usedMB > limitMB * 0.9 ? SeverityNumber.ERROR : SeverityNumber.WARN,
            severityText: usedMB > limitMB * 0.9 ? 'ERROR' : 'WARN',
            body: 'Potential memory leak detected',
            attributes: {
              memory_used_mb: usedMB,
              memory_limit_mb: limitMB,
              growth_rate_mb_per_min: growthRate,
              memory_pressure_ratio: usedMB / limitMB,
            },
          });
        }
      }
      
    } catch (error) {
      safeLog({
        severityNumber: SeverityNumber.WARN,
        severityText: 'WARN',
        body: 'Error in memory leak detection',
        attributes: {
          error: (error as Error).message,
        },
      });
    }
  };
  
  checkMemoryUsage();
  setInterval(checkMemoryUsage, 30000); // Check every 30 seconds
}

// Helper functions
function getPageType(): string {
  if (typeof window === 'undefined') return 'unknown';
  const path = window.location.pathname;
  if (path === '/') return 'home';
  if (path.includes('player')) return 'player';
  if (path.includes('team')) return 'team';
  if (path.includes('comparison')) return 'comparison';
  return 'other';
}
