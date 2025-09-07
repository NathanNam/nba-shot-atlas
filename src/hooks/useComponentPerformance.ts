import { useEffect, useRef, useCallback, useState } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

/**
 * Component Performance Metrics
 */
const componentRenderDuration = meter.createHistogram('component_render_duration_ms', {
  description: 'Duration of component render cycles in milliseconds',
  unit: 'ms',
});

const componentLifecycleCounter = meter.createCounter('component_lifecycle_events_total', {
  description: 'Total number of component lifecycle events',
});

const memoryUsageGauge = meter.createUpDownCounter('component_memory_usage_bytes', {
  description: 'Memory usage attributed to component operations in bytes',
  unit: 'bytes',
});

const renderPerformanceHistogram = meter.createHistogram('component_render_performance_ms', {
  description: 'Component render performance with detailed percentiles',
  unit: 'ms',
});

interface PerformanceMetrics {
  renderTime: number;
  memoryUsed: number;
  isSlowRender: boolean;
  lifecycleEvent: 'mount' | 'update' | 'unmount';
}

interface ComponentPerformanceOptions {
  /**
   * Component name for tracking and identification
   */
  componentName: string;
  /**
   * Enable memory usage tracking (may have slight performance impact)
   */
  trackMemory?: boolean;
  /**
   * Threshold in ms for slow render warning
   */
  slowRenderThreshold?: number;
  /**
   * Enable detailed performance tracking
   */
  enableDetailedTracking?: boolean;
  /**
   * Custom attributes to add to all spans and metrics
   */
  customAttributes?: Record<string, string | number>;
}

export interface UseComponentPerformanceReturn {
  /**
   * Manually track a render operation
   */
  trackRender: (operationName?: string) => void;
  /**
   * Get current performance metrics
   */
  getMetrics: () => PerformanceMetrics | null;
  /**
   * Start a custom performance measurement
   */
  startMeasurement: (name: string) => () => void;
  /**
   * Check if the component is performing poorly
   */
  isPerformingPoorly: boolean;
  /**
   * Current memory usage estimate (if tracking enabled)
   */
  memoryUsage: number;
  /**
   * Average render time over the last 10 renders
   */
  averageRenderTime: number;
}

/**
 * Advanced React component performance tracking hook with OpenTelemetry integration
 * 
 * Provides comprehensive performance monitoring including:
 * - Render time tracking with performance.mark/measure
 * - Memory usage monitoring with performance.memory
 * - Component lifecycle tracking (mount/unmount/update)
 * - Slow render detection and alerting
 * - Custom performance measurements
 * - Performance trend analysis
 * 
 * @param options Configuration options for performance tracking
 * @returns Performance tracking utilities and metrics
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     trackRender,
 *     getMetrics,
 *     startMeasurement,
 *     isPerformingPoorly,
 *     memoryUsage,
 *     averageRenderTime
 *   } = useComponentPerformance({
 *     componentName: 'MyComponent',
 *     trackMemory: true,
 *     slowRenderThreshold: 50,
 *     enableDetailedTracking: true,
 *     customAttributes: { feature: 'dashboard' }
 *   });
 * 
 *   // Manual render tracking
 *   const handleComplexOperation = () => {
 *     const endMeasurement = startMeasurement('complex_operation');
 *     // ... complex logic
 *     endMeasurement();
 *   };
 * 
 *   return (
 *     <div>
 *       {isPerformingPoorly && <PerformanceWarning />}
 *       <div>Memory usage: {memoryUsage}MB</div>
 *       <div>Avg render time: {averageRenderTime}ms</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useComponentPerformance(options: ComponentPerformanceOptions): UseComponentPerformanceReturn {
  const {
    componentName,
    trackMemory = true,
    slowRenderThreshold = 50,
    enableDetailedTracking = false,
    customAttributes = {},
  } = options;

  // Performance tracking state
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [isPerformingPoorly, setIsPerformingPoorly] = useState(false);
  
  // Performance history for trend analysis
  const renderTimes = useRef<number[]>([]);
  const mountTime = useRef<number>(Date.now());
  const lastRenderTime = useRef<number>(Date.now());
  const renderCount = useRef<number>(0);
  
  // Active measurements
  const activeMeasurements = useRef<Map<string, number>>(new Map());

  /**
   * Get current memory usage from performance API
   */
  const getCurrentMemoryUsage = useCallback((): number => {
    if (!trackMemory) return 0;
    
    try {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        if (memory && memory.usedJSHeapSize) {
          return memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
        }
      }
    } catch (error) {
      // Silently handle memory API unavailability
    }
    
    return 0;
  }, [trackMemory]);

  /**
   * Track render performance using Performance API
   */
  const trackRender = useCallback((operationName = 'render') => {
    const renderStart = performance.now();
    const markName = `${componentName}_${operationName}_start`;
    const measureName = `${componentName}_${operationName}`;

    // Use Performance API marks for accurate timing
    if ('mark' in performance) {
      performance.mark(markName);
    }

    // Create OpenTelemetry span for detailed tracing
    const span = tracer.startSpan(`component_performance.${operationName}`, {
      attributes: {
        'component.name': componentName,
        'component.operation': operationName,
        'component.render_count': renderCount.current,
        ...customAttributes,
      },
    });

    requestAnimationFrame(() => {
      try {
        const renderEnd = performance.now();
        const renderDuration = renderEnd - renderStart;

        // Update render count and times history
        renderCount.current++;
        renderTimes.current.push(renderDuration);
        
        // Keep only last 10 render times for average calculation
        if (renderTimes.current.length > 10) {
          renderTimes.current.shift();
        }

        // Get memory usage
        const currentMemory = getCurrentMemoryUsage();
        setMemoryUsage(currentMemory);

        // Determine if this is a slow render
        const isSlowRender = renderDuration > slowRenderThreshold;
        setIsPerformingPoorly(isSlowRender || renderTimes.current.some(time => time > slowRenderThreshold));

        // Use Performance API measure for browser dev tools integration
        if ('measure' in performance && 'mark' in performance) {
          try {
            performance.measure(measureName, markName);
          } catch (error) {
            // Mark might not exist, ignore
          }
        }

        // Record metrics
        componentRenderDuration.record(renderDuration, {
          component_name: componentName,
          operation: operationName,
          is_slow_render: isSlowRender ? 'true' : 'false',
          ...customAttributes,
        });

        renderPerformanceHistogram.record(renderDuration, {
          component: componentName,
          operation: operationName,
          performance_tier: renderDuration < 16 ? 'fast' : renderDuration < 50 ? 'normal' : 'slow',
          frame_budget_met: renderDuration < 16 ? 'true' : 'false',
          ...customAttributes,
        });

        if (trackMemory && currentMemory > 0) {
          memoryUsageGauge.add(currentMemory, {
            component_name: componentName,
            memory_type: 'used_heap',
            ...customAttributes,
          });
        }

        // Update current metrics state
        const metrics: PerformanceMetrics = {
          renderTime: renderDuration,
          memoryUsed: currentMemory,
          isSlowRender,
          lifecycleEvent: renderCount.current === 1 ? 'mount' : 'update',
        };
        setCurrentMetrics(metrics);

        // Set span attributes
        span.setAttributes({
          'component.render_duration_ms': renderDuration,
          'component.is_slow_render': isSlowRender,
          'component.memory_usage_mb': currentMemory,
          'component.render_count': renderCount.current,
        });

        // Log slow renders with detailed context
        if (isSlowRender) {
          logger.emit({
            severityNumber: SeverityNumber.WARN,
            severityText: 'WARN',
            body: `Slow render detected in ${componentName}`,
            attributes: {
              component_name: componentName,
              operation: operationName,
              render_duration_ms: renderDuration,
              slow_render_threshold_ms: slowRenderThreshold,
              memory_usage_mb: currentMemory,
              render_count: renderCount.current,
              url: typeof window !== 'undefined' ? window.location.href : '',
              ...customAttributes,
            },
          });

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `Slow render: ${renderDuration}ms > ${slowRenderThreshold}ms`,
          });
        }

        // Log detailed performance info if enabled
        if (enableDetailedTracking) {
          logger.emit({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `Component render performance: ${componentName}`,
            attributes: {
              component_name: componentName,
              operation: operationName,
              render_duration_ms: renderDuration,
              memory_usage_mb: currentMemory,
              render_count: renderCount.current,
              average_render_time_ms: renderTimes.current.reduce((sum, time) => sum + time, 0) / renderTimes.current.length,
              performance_trend: renderTimes.current.length > 1 ? 
                (renderDuration > renderTimes.current[renderTimes.current.length - 2] ? 'degrading' : 'improving') : 'stable',
              ...customAttributes,
            },
          });
        }

      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `Error tracking render performance: ${(error as Error).message}`,
        });

        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: 'ERROR',
          body: `Error tracking render performance for ${componentName}`,
          attributes: {
            component_name: componentName,
            error: (error as Error).message,
            ...customAttributes,
          },
        });
      } finally {
        span.end();
      }
    });
  }, [componentName, slowRenderThreshold, trackMemory, enableDetailedTracking, customAttributes, getCurrentMemoryUsage]);

  /**
   * Start a custom performance measurement
   */
  const startMeasurement = useCallback((name: string) => {
    const measurementId = `${componentName}_${name}_${Date.now()}`;
    const startTime = performance.now();
    activeMeasurements.current.set(measurementId, startTime);

    const span = tracer.startSpan(`component_measurement.${name}`, {
      attributes: {
        'component.name': componentName,
        'measurement.name': name,
        'measurement.id': measurementId,
        ...customAttributes,
      },
    });

    return () => {
      try {
        const endTime = performance.now();
        const startTime = activeMeasurements.current.get(measurementId);
        
        if (startTime !== undefined) {
          const duration = endTime - startTime;
          
          // Record custom measurement
          componentRenderDuration.record(duration, {
            component_name: componentName,
            operation: name,
            measurement_type: 'custom',
            ...customAttributes,
          });

          span.setAttributes({
            'measurement.duration_ms': duration,
            'measurement.completed': true,
          });

          logger.emit({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `Custom measurement completed: ${name}`,
            attributes: {
              component_name: componentName,
              measurement_name: name,
              duration_ms: duration,
              ...customAttributes,
            },
          });

          activeMeasurements.current.delete(measurementId);
        }
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `Error ending measurement: ${(error as Error).message}`,
        });
      } finally {
        span.end();
      }
    };
  }, [componentName, customAttributes]);

  /**
   * Get current performance metrics
   */
  const getMetrics = useCallback((): PerformanceMetrics | null => {
    return currentMetrics;
  }, [currentMetrics]);

  /**
   * Calculate average render time
   */
  const averageRenderTime = renderTimes.current.length > 0
    ? renderTimes.current.reduce((sum, time) => sum + time, 0) / renderTimes.current.length
    : 0;

  // Component lifecycle tracking
  useEffect(() => {
    const span = tracer.startSpan('component_lifecycle.mount', {
      attributes: {
        'component.name': componentName,
        'component.lifecycle_event': 'mount',
        ...customAttributes,
      },
    });

    try {
      componentLifecycleCounter.add(1, {
        component_name: componentName,
        lifecycle_event: 'mount',
        ...customAttributes,
      });

      logger.emit({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: `Component mounted: ${componentName}`,
        attributes: {
          component_name: componentName,
          mount_time: new Date().toISOString(),
          ...customAttributes,
        },
      });

      // Track initial render
      trackRender('mount');

      // Cleanup on unmount
      return () => {
        const unmountSpan = tracer.startSpan('component_lifecycle.unmount', {
          attributes: {
            'component.name': componentName,
            'component.lifecycle_event': 'unmount',
            'component.total_lifetime_ms': Date.now() - mountTime.current,
            'component.total_renders': renderCount.current,
            ...customAttributes,
          },
        });

        try {
          componentLifecycleCounter.add(1, {
            component_name: componentName,
            lifecycle_event: 'unmount',
            ...customAttributes,
          });

          const totalLifetime = Date.now() - mountTime.current;
          
          logger.emit({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `Component unmounted: ${componentName}`,
            attributes: {
              component_name: componentName,
              total_lifetime_ms: totalLifetime,
              total_renders: renderCount.current,
              average_render_time_ms: averageRenderTime,
              ...customAttributes,
            },
          });

          // Clean up active measurements
          activeMeasurements.current.clear();
        } finally {
          unmountSpan.end();
        }
      };
    } finally {
      span.end();
    }
  }, [componentName, customAttributes, trackRender, averageRenderTime]);

  // Track subsequent renders
  useEffect(() => {
    if (renderCount.current > 1) { // Skip first render as it's tracked in mount
      trackRender('update');
    }
  });

  return {
    trackRender,
    getMetrics,
    startMeasurement,
    isPerformingPoorly,
    memoryUsage,
    averageRenderTime,
  };
}