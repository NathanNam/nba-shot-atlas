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
let webVitalsMetrics: any;
let networkQualityHistogram: any;
let resourceTimingHistogram: any;
let apiResponseSizeHistogram: any;
let cacheEfficiencyGauge: any;

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

    // Web Vitals metrics
    webVitalsMetrics = {
      fcp: meter.createHistogram('web_vitals_fcp_ms', {
        description: 'First Contentful Paint timing',
        unit: 'ms',
      }),
      lcp: meter.createHistogram('web_vitals_lcp_ms', {
        description: 'Largest Contentful Paint timing',
        unit: 'ms',
      }),
      fid: meter.createHistogram('web_vitals_fid_ms', {
        description: 'First Input Delay timing',
        unit: 'ms',
      }),
      cls: meter.createHistogram('web_vitals_cls', {
        description: 'Cumulative Layout Shift score',
      }),
      ttfb: meter.createHistogram('web_vitals_ttfb_ms', {
        description: 'Time to First Byte',
        unit: 'ms',
      }),
    };

    // Network and resource metrics
    networkQualityHistogram = meter.createHistogram('network_quality_score', {
      description: 'Network quality score based on connection speed',
    });

    resourceTimingHistogram = meter.createHistogram('resource_timing_ms', {
      description: 'Resource loading timing by type',
      unit: 'ms',
    });

    apiResponseSizeHistogram = meter.createHistogram('api_response_size_bytes', {
      description: 'Size of API responses by endpoint',
      unit: 'By',
    });

    cacheEfficiencyGauge = meter.createUpDownCounter('cache_efficiency_ratio', {
      description: 'Cache hit to miss ratio',
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

export function trackApiCall(
  apiEndpoint: string, 
  duration: number, 
  statusCode?: number, 
  errorMessage?: string,
  responseSize?: number,
  cacheHit?: boolean,
  networkTiming?: {
    dns?: number;
    connect?: number;
    ssl?: number;
    wait?: number;
    receive?: number;
  }
) {
  if (apiCallDuration?.record) {
    apiCallDuration.record(duration, {
      endpoint: apiEndpoint,
      status_code: statusCode ? statusCode.toString() : 'unknown',
      success: (!errorMessage && (!statusCode || statusCode < 400)) ? 'true' : 'false',
      cache_hit: cacheHit ? 'true' : 'false',
    });
  }

  // Track response size
  if (responseSize && apiResponseSizeHistogram?.record) {
    apiResponseSizeHistogram.record(responseSize, {
      endpoint: apiEndpoint,
      status_code: statusCode ? statusCode.toString() : 'unknown',
    });
  }

  // Track detailed network timing if available
  if (networkTiming && resourceTimingHistogram?.record) {
    Object.entries(networkTiming).forEach(([phase, timing]) => {
      if (timing && timing > 0) {
        resourceTimingHistogram.record(timing, {
          resource_type: 'api_call',
          endpoint: apiEndpoint,
          timing_phase: phase,
        });
      }
    });
  }

  if (errorMessage && errorCounter?.add) {
    errorCounter.add(1, {
      error_type: 'api_error',
      endpoint: apiEndpoint,
      status_code: statusCode?.toString() || 'unknown',
    });
  }

  // Calculate network quality score
  const networkScore = calculateNetworkQualityScore(duration, networkTiming);
  if (networkScore !== null && networkQualityHistogram?.record) {
    networkQualityHistogram.record(networkScore, {
      endpoint: apiEndpoint,
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
      response_size_bytes: responseSize,
      cache_hit: cacheHit,
      performance_tier: duration < 1000 ? 'fast' : duration < 5000 ? 'normal' : 'slow',
      network_timing: networkTiming ? JSON.stringify(networkTiming) : undefined,
      network_quality_score: networkScore,
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

// Helper function to calculate network quality score
function calculateNetworkQualityScore(duration: number, networkTiming?: {
  dns?: number;
  connect?: number;
  ssl?: number;
  wait?: number;
  receive?: number;
}): number | null {
  if (!networkTiming) {
    // Fallback score based on total duration
    if (duration < 500) return 1.0;
    if (duration < 1000) return 0.8;
    if (duration < 2000) return 0.6;
    if (duration < 5000) return 0.4;
    return 0.2;
  }

  const { dns = 0, connect = 0, ssl = 0, wait = 0, receive = 0 } = networkTiming;
  const totalNetworkTime = dns + connect + ssl + wait + receive;
  
  if (totalNetworkTime === 0) return null;

  // Calculate quality based on different phases
  let score = 1.0;
  
  // DNS resolution (good < 50ms, poor > 200ms)
  if (dns > 200) score -= 0.2;
  else if (dns > 100) score -= 0.1;
  
  // Connection time (good < 100ms, poor > 500ms)
  if (connect > 500) score -= 0.2;
  else if (connect > 200) score -= 0.1;
  
  // Server wait time (good < 200ms, poor > 1000ms)
  if (wait > 1000) score -= 0.3;
  else if (wait > 500) score -= 0.2;
  else if (wait > 200) score -= 0.1;
  
  // Data receive time (good < 100ms, poor > 500ms)
  if (receive > 500) score -= 0.2;
  else if (receive > 200) score -= 0.1;
  
  return Math.max(0, Math.min(1, score));
}

// Web Vitals tracking functions
export function trackWebVitals() {
  if (typeof window === 'undefined' || !webVitalsMetrics) return;

  // Track Core Web Vitals using Performance Observer API
  try {
    // First Contentful Paint (FCP)
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name === 'first-contentful-paint' && webVitalsMetrics?.fcp?.record) {
          webVitalsMetrics.fcp.record(entry.startTime, {
            metric_type: 'fcp',
            rating: entry.startTime < 1800 ? 'good' : entry.startTime < 3000 ? 'needs-improvement' : 'poor',
          });
          
          safeLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'First Contentful Paint measured',
            attributes: {
              fcp_ms: entry.startTime,
              fcp_rating: entry.startTime < 1800 ? 'good' : entry.startTime < 3000 ? 'needs-improvement' : 'poor',
            },
          });
        }
      });
    });
    
    observer.observe({ entryTypes: ['paint'] });

    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      if (lastEntry && webVitalsMetrics?.lcp?.record) {
        webVitalsMetrics.lcp.record(lastEntry.startTime, {
          metric_type: 'lcp',
          rating: lastEntry.startTime < 2500 ? 'good' : lastEntry.startTime < 4000 ? 'needs-improvement' : 'poor',
        });
        
        safeLog({
          severityNumber: SeverityNumber.INFO,
          severityText: 'INFO',
          body: 'Largest Contentful Paint measured',
          attributes: {
            lcp_ms: lastEntry.startTime,
            lcp_rating: lastEntry.startTime < 2500 ? 'good' : lastEntry.startTime < 4000 ? 'needs-improvement' : 'poor',
          },
        });
      }
    });
    
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        const fid = entry.processingStart - entry.startTime;
        
        if (webVitalsMetrics?.fid?.record) {
          webVitalsMetrics.fid.record(fid, {
            metric_type: 'fid',
            rating: fid < 100 ? 'good' : fid < 300 ? 'needs-improvement' : 'poor',
          });
          
          safeLog({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: 'First Input Delay measured',
            attributes: {
              fid_ms: fid,
              fid_rating: fid < 100 ? 'good' : fid < 300 ? 'needs-improvement' : 'poor',
            },
          });
        }
      });
    });
    
    fidObserver.observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS) - approximation
    let clsValue = 0;
    let sessionValue = 0;
    let sessionEntries: any[] = [];
    
    const clsObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          const firstSessionEntry = sessionEntries[0];
          const lastSessionEntry = sessionEntries[sessionEntries.length - 1];
          
          if (sessionValue &&
              entry.startTime - lastSessionEntry.startTime < 1000 &&
              entry.startTime - firstSessionEntry.startTime < 5000) {
            sessionValue += entry.value;
            sessionEntries.push(entry);
          } else {
            sessionValue = entry.value;
            sessionEntries = [entry];
          }
          
          if (sessionValue > clsValue) {
            clsValue = sessionValue;
            
            if (webVitalsMetrics?.cls?.record) {
              webVitalsMetrics.cls.record(clsValue, {
                metric_type: 'cls',
                rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor',
              });
            }
          }
        }
      });
    });
    
    clsObserver.observe({ entryTypes: ['layout-shift'] });

  } catch (error) {
    safeLog({
      severityNumber: SeverityNumber.WARN,
      severityText: 'WARN',
      body: 'Failed to set up Web Vitals tracking',
      attributes: {
        error: (error as Error).message,
      },
    });
  }
}

// Enhanced cache tracking
export function trackCachePerformance(operation: string, hitCount: number, missCount: number, size?: number) {
  const totalRequests = hitCount + missCount;
  const hitRatio = totalRequests > 0 ? hitCount / totalRequests : 0;
  
  if (cacheEfficiencyGauge?.add) {
    cacheEfficiencyGauge.add(hitRatio, {
      cache_operation: operation,
      cache_size_category: size ? (size < 100 ? 'small' : size < 1000 ? 'medium' : 'large') : 'unknown',
    });
  }

  if (cacheHitCounter?.add) {
    cacheHitCounter.add(hitCount, {
      operation: operation,
      result: 'hit',
    });
    
    cacheHitCounter.add(missCount, {
      operation: operation,
      result: 'miss',
    });
  }

  safeLog({
    severityNumber: hitRatio < 0.5 ? SeverityNumber.WARN : SeverityNumber.DEBUG,
    severityText: hitRatio < 0.5 ? 'WARN' : 'DEBUG',
    body: `Cache performance: ${operation}`,
    attributes: {
      cache_operation: operation,
      cache_hit_count: hitCount,
      cache_miss_count: missCount,
      cache_hit_ratio: hitRatio,
      cache_efficiency: hitRatio >= 0.8 ? 'excellent' : hitRatio >= 0.6 ? 'good' : hitRatio >= 0.4 ? 'fair' : 'poor',
    },
  });
}

// Global performance monitoring setup
export function setupGlobalPerformanceMonitoring() {
  const span = tracer.startSpan('performance_monitor.setup_global_monitoring');

  try {
    // Set up Web Vitals tracking
    trackWebVitals();

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

            // Track Time to First Byte (TTFB)
            if (webVitalsMetrics?.ttfb?.record && navigation.responseStart) {
              const ttfb = navigation.responseStart - navigation.fetchStart;
              webVitalsMetrics.ttfb.record(ttfb, {
                metric_type: 'ttfb',
                rating: ttfb < 600 ? 'good' : ttfb < 1500 ? 'needs-improvement' : 'poor',
              });
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
