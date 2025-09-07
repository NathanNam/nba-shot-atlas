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

// Core Web Vitals monitoring
let coreWebVitalsMetrics: any = {};

// Initialize Core Web Vitals metrics
const initCoreWebVitalsMetrics = () => {
  if (meter?.createHistogram) {
    coreWebVitalsMetrics = {
      cls: meter.createHistogram('core_web_vitals_cls', {
        description: 'Cumulative Layout Shift (CLS) - visual stability metric',
        unit: 'score',
      }),
      fid: meter.createHistogram('core_web_vitals_fid', {
        description: 'First Input Delay (FID) - interactivity metric',
        unit: 'ms',
      }),
      lcp: meter.createHistogram('core_web_vitals_lcp', {
        description: 'Largest Contentful Paint (LCP) - loading performance metric',
        unit: 'ms',
      }),
      inp: meter.createHistogram('core_web_vitals_inp', {
        description: 'Interaction to Next Paint (INP) - responsiveness metric',
        unit: 'ms',
      }),
      fcp: meter.createHistogram('core_web_vitals_fcp', {
        description: 'First Contentful Paint (FCP) - loading performance metric',
        unit: 'ms',
      }),
      ttfb: meter.createHistogram('core_web_vitals_ttfb', {
        description: 'Time to First Byte (TTFB) - server response time',
        unit: 'ms',
      }),
    };
  }
};

// Initialize Core Web Vitals metrics on module load
initCoreWebVitalsMetrics();

// Track Core Web Vitals
export function trackCoreWebVitals() {
  const span = tracer.startSpan('performance_monitor.core_web_vitals_tracking');
  
  try {
    // Use web-vitals library approach but with manual calculation if not available
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // Track Largest Contentful Paint (LCP)
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          
          if (lastEntry && coreWebVitalsMetrics.lcp) {
            const lcpValue = lastEntry.startTime;
            coreWebVitalsMetrics.lcp.record(lcpValue, {
              element_tag: lastEntry.element?.tagName?.toLowerCase() || 'unknown',
              url: window.location.pathname,
              performance_rating: lcpValue <= 2500 ? 'good' : lcpValue <= 4000 ? 'needs_improvement' : 'poor',
            });

            safeLog({
              severityNumber: lcpValue > 4000 ? SeverityNumber.WARN : SeverityNumber.DEBUG,
              severityText: lcpValue > 4000 ? 'WARN' : 'DEBUG',
              body: 'Largest Contentful Paint measured',
              attributes: {
                lcp_value_ms: lcpValue,
                lcp_element: lastEntry.element?.tagName || 'unknown',
                lcp_rating: lcpValue <= 2500 ? 'good' : lcpValue <= 4000 ? 'needs_improvement' : 'poor',
                url: window.location.href,
              },
            });
          }
        });
        
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (error) {
        console.warn('LCP observer setup failed:', error);
      }

      // Track First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry: any) => {
            if (coreWebVitalsMetrics.fid) {
              const fidValue = entry.processingStart - entry.startTime;
              coreWebVitalsMetrics.fid.record(fidValue, {
                interaction_type: entry.name || 'unknown',
                url: window.location.pathname,
                performance_rating: fidValue <= 100 ? 'good' : fidValue <= 300 ? 'needs_improvement' : 'poor',
              });

              safeLog({
                severityNumber: fidValue > 300 ? SeverityNumber.WARN : SeverityNumber.DEBUG,
                severityText: fidValue > 300 ? 'WARN' : 'DEBUG',
                body: 'First Input Delay measured',
                attributes: {
                  fid_value_ms: fidValue,
                  interaction_type: entry.name,
                  fid_rating: fidValue <= 100 ? 'good' : fidValue <= 300 ? 'needs_improvement' : 'poor',
                  url: window.location.href,
                },
              });
            }
          });
        });
        
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (error) {
        console.warn('FID observer setup failed:', error);
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

          if (coreWebVitalsMetrics.cls) {
            coreWebVitalsMetrics.cls.record(clsValue, {
              url: window.location.pathname,
              performance_rating: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs_improvement' : 'poor',
            });

            if (clsValue > 0.1) {
              safeLog({
                severityNumber: clsValue > 0.25 ? SeverityNumber.WARN : SeverityNumber.INFO,
                severityText: clsValue > 0.25 ? 'WARN' : 'INFO',
                body: 'Cumulative Layout Shift measured',
                attributes: {
                  cls_value: clsValue,
                  cls_rating: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs_improvement' : 'poor',
                  url: window.location.href,
                },
              });
            }
          }
        });
        
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        console.warn('CLS observer setup failed:', error);
      }

      // Track Interaction to Next Paint (INP) - simplified approach
      try {
        let interactions: Array<{startTime: number, duration: number, type: string}> = [];
        
        ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup'].forEach(eventType => {
          document.addEventListener(eventType, (event) => {
            const startTime = performance.now();
            requestAnimationFrame(() => {
              const duration = performance.now() - startTime;
              interactions.push({ startTime, duration, type: eventType });
              
              // Keep only recent interactions (last 50)
              if (interactions.length > 50) {
                interactions = interactions.slice(-50);
              }
              
              // Calculate INP as 98th percentile of interaction durations
              if (interactions.length >= 10) {
                const sortedDurations = interactions.map(i => i.duration).sort((a, b) => a - b);
                const p98Index = Math.floor(sortedDurations.length * 0.98);
                const inpValue = sortedDurations[p98Index];
                
                if (coreWebVitalsMetrics.inp && inpValue > 0) {
                  coreWebVitalsMetrics.inp.record(inpValue, {
                    interaction_type: eventType,
                    url: window.location.pathname,
                    performance_rating: inpValue <= 200 ? 'good' : inpValue <= 500 ? 'needs_improvement' : 'poor',
                  });
                }
              }
            });
          }, { passive: true });
        });
      } catch (error) {
        console.warn('INP tracking setup failed:', error);
      }

      // Track First Contentful Paint (FCP) and Time to First Byte (TTFB)
      try {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          const ttfbValue = navigation.responseStart - navigation.fetchStart;
          if (coreWebVitalsMetrics.ttfb) {
            coreWebVitalsMetrics.ttfb.record(ttfbValue, {
              url: window.location.pathname,
              performance_rating: ttfbValue <= 800 ? 'good' : ttfbValue <= 1800 ? 'needs_improvement' : 'poor',
            });
          }

          const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
          if (fcpEntry && coreWebVitalsMetrics.fcp) {
            const fcpValue = fcpEntry.startTime;
            coreWebVitalsMetrics.fcp.record(fcpValue, {
              url: window.location.pathname,
              performance_rating: fcpValue <= 1800 ? 'good' : fcpValue <= 3000 ? 'needs_improvement' : 'poor',
            });
          }
        }
      } catch (error) {
        console.warn('FCP/TTFB tracking setup failed:', error);
      }
    }

    span.setAttributes({
      'core_web_vitals.tracking_enabled': true,
      'core_web_vitals.performance_observer_supported': 'PerformanceObserver' in window,
    });

    safeLog({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Core Web Vitals tracking initialized',
      attributes: {
        performance_observer_supported: 'PerformanceObserver' in window,
        url: window.location.href,
      },
    });

  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: 'Failed to setup Core Web Vitals tracking',
    });
    
    safeLog({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: 'Failed to setup Core Web Vitals tracking',
      attributes: {
        error: (error as Error).message,
      },
    });
  } finally {
    span.end();
  }
}

// Enhanced API correlation tracking
export function trackAPIResponseTime(apiEndpoint: string, duration: number, statusCode?: number, errorMessage?: string, uxCorrelation?: {
  componentName: string;
  renderDelay: number;
  userWaitTime: number;
}) {
  if (apiCallDuration?.record) {
    apiCallDuration.record(duration, {
      endpoint: apiEndpoint,
      status_code: statusCode ? statusCode.toString() : 'unknown',
      success: (!errorMessage && (!statusCode || statusCode < 400)) ? 'true' : 'false',
      has_ux_correlation: uxCorrelation ? 'true' : 'false',
    });
  }

  // Enhanced API-UX correlation
  if (uxCorrelation && renderPerformanceHistogram?.record) {
    renderPerformanceHistogram.record(uxCorrelation.renderDelay, {
      component: uxCorrelation.componentName,
      event_type: 'api_dependent_render',
      api_endpoint: apiEndpoint,
      api_duration_ms: duration,
      user_wait_time_ms: uxCorrelation.userWaitTime,
      performance_tier: uxCorrelation.renderDelay < 50 ? 'fast' : uxCorrelation.renderDelay < 200 ? 'normal' : 'slow',
    });
  }

  if (errorMessage && errorCounter?.add) {
    errorCounter.add(1, {
      error_type: 'api_error',
      endpoint: apiEndpoint,
      status_code: statusCode?.toString() || 'unknown',
      affects_ux: uxCorrelation ? 'true' : 'false',
    });
  }

  safeLog({
    severityNumber: errorMessage ? SeverityNumber.ERROR : duration > 5000 ? SeverityNumber.WARN : SeverityNumber.DEBUG,
    severityText: errorMessage ? 'ERROR' : duration > 5000 ? 'WARN' : 'DEBUG',
    body: `Enhanced API call with UX correlation: ${apiEndpoint}`,
    attributes: {
      api_endpoint: apiEndpoint,
      duration_ms: duration,
      status_code: statusCode,
      error_message: errorMessage,
      performance_tier: duration < 1000 ? 'fast' : duration < 5000 ? 'normal' : 'slow',
      ux_correlation: uxCorrelation ? JSON.stringify(uxCorrelation) : undefined,
    },
  });
}

// Memory leak detection
let memoryLeakDetection: any = {
  baseline: 0,
  measurements: [] as number[],
  intervalId: null as NodeJS.Timeout | null,
};

export function startMemoryLeakDetection() {
  if (typeof window === 'undefined' || !('memory' in performance)) {
    return;
  }

  const span = tracer.startSpan('performance_monitor.memory_leak_detection_start');
  
  try {
    const memory = (performance as any).memory;
    memoryLeakDetection.baseline = memory.usedJSHeapSize;
    
    memoryLeakDetection.intervalId = setInterval(() => {
      const currentMemory = memory.usedJSHeapSize;
      const memoryDiff = currentMemory - memoryLeakDetection.baseline;
      
      memoryLeakDetection.measurements.push(currentMemory);
      
      // Keep only last 20 measurements
      if (memoryLeakDetection.measurements.length > 20) {
        memoryLeakDetection.measurements = memoryLeakDetection.measurements.slice(-20);
      }
      
      // Check for potential memory leak (consistent growth over time)
      if (memoryLeakDetection.measurements.length >= 10) {
        const recent10 = memoryLeakDetection.measurements.slice(-10);
        const isGrowingConsistently = recent10.every((val, i) => i === 0 || val >= recent10[i - 1]);
        const growthRate = (recent10[recent10.length - 1] - recent10[0]) / recent10.length;
        
        if (isGrowingConsistently && growthRate > 1024 * 1024) { // Growing by 1MB per measurement
          const memoryLeakCounter = meter.createCounter('memory_leak_detected_total', {
            description: 'Potential memory leaks detected',
          });
          
          if (memoryLeakCounter) {
            memoryLeakCounter.add(1, {
              growth_rate_mb: Math.round(growthRate / (1024 * 1024)),
              url_pathname: window.location.pathname,
              detection_confidence: 'high',
            });
          }
          
          safeLog({
            severityNumber: SeverityNumber.WARN,
            severityText: 'WARN',
            body: 'Potential memory leak detected',
            attributes: {
              current_memory_mb: Math.round(currentMemory / (1024 * 1024)),
              baseline_memory_mb: Math.round(memoryLeakDetection.baseline / (1024 * 1024)),
              memory_growth_mb: Math.round(memoryDiff / (1024 * 1024)),
              growth_rate_mb_per_interval: Math.round(growthRate / (1024 * 1024)),
              url: window.location.href,
            },
          });
        }
      }
      
      // Update memory usage gauge
      if (memoryUsageGauge?.add) {
        const currentMemoryMB = currentMemory / (1024 * 1024);
        memoryUsageGauge.add(currentMemoryMB, { memory_type: 'used' });
      }
    }, 15000); // Check every 15 seconds

    span.setAttributes({
      'memory_leak_detection.enabled': true,
      'memory_leak_detection.baseline_mb': Math.round(memoryLeakDetection.baseline / (1024 * 1024)),
      'memory_leak_detection.interval_ms': 15000,
    });
    
    safeLog({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Memory leak detection started',
      attributes: {
        baseline_memory_mb: Math.round(memoryLeakDetection.baseline / (1024 * 1024)),
        check_interval_ms: 15000,
      },
    });
    
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: 'Failed to start memory leak detection',
    });
  } finally {
    span.end();
  }
}

export function stopMemoryLeakDetection() {
  if (memoryLeakDetection.intervalId) {
    clearInterval(memoryLeakDetection.intervalId);
    memoryLeakDetection.intervalId = null;
    
    safeLog({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Memory leak detection stopped',
    });
  }
}

// Global performance monitoring setup with enhanced features
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

      // Initialize Core Web Vitals tracking
      trackCoreWebVitals();
      
      // Start memory leak detection
      startMemoryLeakDetection();

      safeLog({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Enhanced global performance monitoring setup completed',
        attributes: {
          user_agent: navigator.userAgent,
          url: window.location.href,
          core_web_vitals_enabled: true,
          memory_leak_detection_enabled: 'memory' in performance,
          performance_observer_supported: 'PerformanceObserver' in window,
        },
      });
    }
  } finally {
    span.end();
  }
}

// Component re-render pattern monitoring
export function useComponentPerformance(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  const renderDurations = useRef<number[]>([]);
  
  useEffect(() => {
    const currentTime = Date.now();
    const renderDuration = currentTime - lastRenderTime.current;
    renderCount.current++;
    
    renderDurations.current.push(renderDuration);
    
    // Keep only last 10 render durations
    if (renderDurations.current.length > 10) {
      renderDurations.current = renderDurations.current.slice(-10);
    }
    
    // Check for excessive re-renders
    if (renderCount.current > 5 && renderDurations.current.length >= 5) {
      const avgRenderDuration = renderDurations.current.reduce((a, b) => a + b, 0) / renderDurations.current.length;
      const recentRenders = renderCount.current;
      
      // If component has rendered more than 10 times in a short period
      if (recentRenders > 10) {
        const excessiveRenderCounter = meter.createCounter('excessive_renders_total', {
          description: 'Components with excessive re-render patterns',
        });
        
        if (excessiveRenderCounter) {
          excessiveRenderCounter.add(1, {
            component_name: componentName,
            render_count: recentRenders,
            avg_duration_ms: Math.round(avgRenderDuration),
            performance_impact: avgRenderDuration > 50 ? 'high' : avgRenderDuration > 16 ? 'medium' : 'low',
          });
        }
        
        safeLog({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: 'Excessive component re-renders detected',
          attributes: {
            component_name: componentName,
            render_count: recentRenders,
            avg_render_duration_ms: avgRenderDuration,
            recent_render_durations: JSON.stringify(renderDurations.current),
            url: typeof window !== 'undefined' ? window.location.href : '',
          },
        });
      }
    }
    
    lastRenderTime.current = currentTime;
  });

  return {
    renderCount: renderCount.current,
    avgRenderDuration: renderDurations.current.length > 0 
      ? renderDurations.current.reduce((a, b) => a + b, 0) / renderDurations.current.length 
      : 0,
  };
}
