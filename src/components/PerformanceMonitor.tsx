import { useEffect, useRef } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

// Performance metrics
const pageLoadDuration = meter.createHistogram('page_load_duration_ms', {
  description: 'Duration of page load events',
});

const componentRenderDuration = meter.createHistogram('component_render_duration_ms', {
  description: 'Duration of component render cycles',
});

const userInteractionCounter = meter.createCounter('user_interactions_total', {
  description: 'Total number of user interactions',
});

const performanceObservationCounter = meter.createCounter('performance_observations_total', {
  description: 'Total number of performance observations',
});

const memoryUsageGauge = meter.createUpDownCounter('memory_usage_mb', {
  description: 'Current memory usage in megabytes',
});

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
      
      componentRenderDuration.record(mountDuration, {
        component_name: componentName,
        lifecycle_event: 'mount',
      });

      logger.emit({
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
          
          logger.emit({
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
    
    componentRenderDuration.record(renderDuration, {
      component_name: componentName,
      lifecycle_event: 'render',
    });

    if (renderDuration > 100) { // Log slow renders
      logger.emit({
        severityNumber: SeverityNumber.WARN,
        severityText: 'WARN',
        body: 'Slow component render detected',
        attributes: {
          component_name: componentName,
          render_duration_ms: renderDuration,
        },
      });
    }
  });

  return <>{children}</>;
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

            pageLoadDuration.record(loadTime, { event_type: 'load' });
            pageLoadDuration.record(domContentLoaded, { event_type: 'dom_content_loaded' });
            
            if (firstPaint > 0) {
              pageLoadDuration.record(firstPaint, { event_type: 'first_paint' });
            }
            
            if (firstContentfulPaint > 0) {
              pageLoadDuration.record(firstContentfulPaint, { event_type: 'first_contentful_paint' });
            }

            logger.emit({
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
          userInteractionCounter.add(1, {
            interaction_type: eventType,
            target_tag: (event.target as Element)?.tagName?.toLowerCase() || 'unknown',
          });
        }, { passive: true });
      });

      // Monitor memory usage periodically
      if ('memory' in performance) {
        const monitorMemory = () => {
          const memory = (performance as any).memory;
          if (memory) {
            const usedMB = memory.usedJSHeapSize / 1024 / 1024;
            const totalMB = memory.totalJSHeapSize / 1024 / 1024;
            
            memoryUsageGauge.add(usedMB, { memory_type: 'used' });
            memoryUsageGauge.add(totalMB, { memory_type: 'total' });

            // Log high memory usage
            if (usedMB > 100) {
              logger.emit({
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
              performanceObservationCounter.add(1, { observation_type: 'long_task' });
              
              logger.emit({
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
          logger.emit({
            severityNumber: SeverityNumber.WARN,
            severityText: 'WARN',
            body: 'Failed to setup long task observer',
            attributes: {
              error: (error as Error).message,
            },
          });
        }
      }

      logger.emit({
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
