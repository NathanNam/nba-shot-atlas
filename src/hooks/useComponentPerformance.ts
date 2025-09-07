import { useRef, useEffect, useCallback, useMemo } from 'react';
import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

// Performance metrics for component tracking
const componentRenderDuration = meter.createHistogram('component_render_duration_ms', {
  description: 'Time taken for component renders in milliseconds',
  unit: 'ms',
});

const componentLifecycleDuration = meter.createHistogram('component_lifecycle_duration_ms', {
  description: 'Time taken for component lifecycle events',
  unit: 'ms',
});

const componentRenderCount = meter.createCounter('component_renders_total', {
  description: 'Total number of component renders',
});

const componentMountCount = meter.createCounter('component_mounts_total', {
  description: 'Total number of component mounts',
});

const componentUpdateCount = meter.createCounter('component_updates_total', {
  description: 'Total number of component updates',
});

const componentUnmountCount = meter.createCounter('component_unmounts_total', {
  description: 'Total number of component unmounts',
});

const slowRenderCount = meter.createCounter('component_slow_renders_total', {
  description: 'Total number of slow component renders (>50ms)',
});

const componentErrorCount = meter.createCounter('component_errors_total', {
  description: 'Total number of component performance-related errors',
});

interface PerformanceConfig {
  /** Component name for tracking (defaults to 'unknown') */
  componentName?: string;
  /** Threshold in ms to consider a render as slow (defaults to 50) */
  slowRenderThreshold?: number;
  /** Whether to enable detailed render tracking (defaults to true) */
  enableRenderTracking?: boolean;
  /** Whether to track prop changes (defaults to false) */
  trackPropChanges?: boolean;
  /** Whether to track state changes (defaults to false) */
  trackStateChanges?: boolean;
  /** Additional metadata for spans */
  metadata?: Record<string, string | number | boolean>;
}

interface RenderMetrics {
  /** Duration of the last render in milliseconds */
  lastRenderDuration: number;
  /** Total number of renders since mount */
  renderCount: number;
  /** Average render duration in milliseconds */
  averageRenderDuration: number;
  /** Duration since component mount in milliseconds */
  mountDuration: number;
  /** Whether the last render was considered slow */
  wasSlowRender: boolean;
}

interface PerformanceData {
  /** Start a new render measurement */
  startRender: () => void;
  /** End the current render measurement */
  endRender: (renderType?: 'initial' | 'update' | 'props' | 'state') => void;
  /** Get current render metrics */
  getMetrics: () => RenderMetrics;
  /** Log a performance warning */
  logPerformanceIssue: (issue: string, details?: Record<string, any>) => void;
  /** Track a specific operation within the component */
  trackOperation: <T>(operationName: string, operation: () => T | Promise<T>) => Promise<T>;
}

/**
 * Advanced hook for tracking component performance with comprehensive OpenTelemetry instrumentation.
 * Automatically tracks render times, lifecycle events, and provides utilities for custom performance monitoring.
 * 
 * @example
 * ```tsx
 * function ExpensiveComponent({ data, filters }: Props) {
 *   const perf = useComponentPerformance({
 *     componentName: 'ExpensiveComponent',
 *     slowRenderThreshold: 100,
 *     trackPropChanges: true,
 *     metadata: { data_size: data?.length || 0 }
 *   });
 * 
 *   // Track expensive operations
 *   const processedData = useMemo(async () => {
 *     return await perf.trackOperation('data-processing', () => {
 *       return processLargeDataset(data, filters);
 *     });
 *   }, [data, filters, perf]);
 * 
 *   // Manual render tracking for custom scenarios
 *   useEffect(() => {
 *     perf.startRender();
 *     // ... complex render logic
 *     perf.endRender('props');
 *   }, [data, perf]);
 * 
 *   const metrics = perf.getMetrics();
 * 
 *   return (
 *     <div>
 *       {process.env.NODE_ENV === 'development' && (
 *         <div>Avg render: {metrics.averageRenderDuration}ms</div>
 *       )}
 *       {/* Component content */}
 *     </div>
 *   );
 * }
 * ```
 */
export function useComponentPerformance(config: PerformanceConfig = {}): PerformanceData {
  const {
    componentName = 'unknown',
    slowRenderThreshold = 50,
    enableRenderTracking = true,
    trackPropChanges = false,
    trackStateChanges = false,
    metadata = {}
  } = config;

  // Refs for tracking performance data
  const mountTime = useRef<number>(Date.now());
  const currentRenderStart = useRef<number | null>(null);
  const renderTimes = useRef<number[]>([]);
  const renderCount = useRef<number>(0);
  const lastRenderType = useRef<string>('initial');
  const componentSpan = useRef<any>(null);
  const previousProps = useRef<any>(null);
  const previousState = useRef<any>(null);

  // Initialize component span on mount
  useEffect(() => {
    const span = tracer.startSpan(`component.${componentName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'component.name': componentName,
        'component.lifecycle_event': 'mount',
        'component.enable_render_tracking': enableRenderTracking,
        'component.slow_render_threshold_ms': slowRenderThreshold,
        ...Object.fromEntries(
          Object.entries(metadata).map(([k, v]) => [`component.${k}`, v])
        ),
      },
    });

    componentSpan.current = span;

    // Record mount metrics
    componentMountCount.add(1, {
      component_name: componentName,
    });

    logger.emit({
      severityNumber: SeverityNumber.DEBUG,
      severityText: 'DEBUG',
      body: `Component mounted: ${componentName}`,
      attributes: {
        component_name: componentName,
        component_config: JSON.stringify(config),
        trace_id: span.spanContext().traceId,
        span_id: span.spanContext().spanId,
        ...metadata,
      },
    });

    // Cleanup on unmount
    return () => {
      const unmountDuration = Date.now() - mountTime.current;

      componentUnmountCount.add(1, {
        component_name: componentName,
      });

      componentLifecycleDuration.record(unmountDuration, {
        component_name: componentName,
        lifecycle_event: 'unmount',
      });

      span.setAttributes({
        'component.lifecycle_event': 'unmount',
        'component.total_lifetime_ms': unmountDuration,
        'component.total_renders': renderCount.current,
        'component.average_render_duration_ms': renderTimes.current.length > 0 
          ? renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length 
          : 0,
      });

      logger.emit({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: `Component unmounted: ${componentName}`,
        attributes: {
          component_name: componentName,
          total_lifetime_ms: unmountDuration,
          total_renders: renderCount.current,
          average_render_duration_ms: renderTimes.current.length > 0 
            ? renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length 
            : 0,
          trace_id: span.spanContext().traceId,
          span_id: span.spanContext().spanId,
        },
      });

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    };
  }, [componentName, slowRenderThreshold, enableRenderTracking, metadata]);

  // Automatic render tracking
  useEffect(() => {
    if (!enableRenderTracking) return;

    const renderStart = Date.now();
    const isInitialRender = renderCount.current === 0;
    
    // End of render (next tick)
    const timeoutId = setTimeout(() => {
      const renderDuration = Date.now() - renderStart;
      endRender(isInitialRender ? 'initial' : 'update', renderDuration);
    }, 0);

    return () => clearTimeout(timeoutId);
  });

  const startRender = useCallback(() => {
    currentRenderStart.current = Date.now();
  }, []);

  const endRender = useCallback((renderType: 'initial' | 'update' | 'props' | 'state' = 'update', duration?: number) => {
    const renderDuration = duration ?? (currentRenderStart.current 
      ? Date.now() - currentRenderStart.current 
      : 0);
    
    if (renderDuration <= 0) return;

    renderCount.current++;
    renderTimes.current.push(renderDuration);
    lastRenderType.current = renderType;

    // Keep only last 100 render times to prevent memory bloat
    if (renderTimes.current.length > 100) {
      renderTimes.current = renderTimes.current.slice(-100);
    }

    const isSlowRender = renderDuration > slowRenderThreshold;

    // Record metrics
    componentRenderDuration.record(renderDuration, {
      component_name: componentName,
      render_type: renderType,
      is_slow: isSlowRender.toString(),
    });

    componentRenderCount.add(1, {
      component_name: componentName,
      render_type: renderType,
    });

    if (renderType === 'update') {
      componentUpdateCount.add(1, {
        component_name: componentName,
      });
    }

    if (isSlowRender) {
      slowRenderCount.add(1, {
        component_name: componentName,
        render_type: renderType,
      });

      logger.emit({
        severityNumber: SeverityNumber.WARN,
        severityText: 'WARN',
        body: `Slow render detected in ${componentName}`,
        attributes: {
          component_name: componentName,
          render_duration_ms: renderDuration,
          render_type: renderType,
          slow_render_threshold_ms: slowRenderThreshold,
          total_renders: renderCount.current,
          trace_id: componentSpan.current?.spanContext().traceId,
          span_id: componentSpan.current?.spanContext().spanId,
          ...metadata,
        },
      });
    }

    // Update component span
    if (componentSpan.current) {
      componentSpan.current.addEvent('render_completed', {
        'render.duration_ms': renderDuration,
        'render.type': renderType,
        'render.is_slow': isSlowRender,
        'render.count': renderCount.current,
      });
    }

    // Debug logging for development
    if (process.env.NODE_ENV === 'development' && (isSlowRender || renderDuration > 16)) {
      logger.emit({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: `Render performance: ${componentName} (${renderDuration}ms)`,
        attributes: {
          component_name: componentName,
          render_duration_ms: renderDuration,
          render_type: renderType,
          frame_budget_exceeded: renderDuration > 16,
          trace_id: componentSpan.current?.spanContext().traceId,
          span_id: componentSpan.current?.spanContext().spanId,
        },
      });
    }

    currentRenderStart.current = null;
  }, [componentName, slowRenderThreshold, metadata]);

  const getMetrics = useCallback((): RenderMetrics => {
    const totalRenderTime = renderTimes.current.reduce((sum, time) => sum + time, 0);
    const lastRenderDuration = renderTimes.current[renderTimes.current.length - 1] || 0;

    return {
      lastRenderDuration,
      renderCount: renderCount.current,
      averageRenderDuration: renderTimes.current.length > 0 
        ? totalRenderTime / renderTimes.current.length 
        : 0,
      mountDuration: Date.now() - mountTime.current,
      wasSlowRender: lastRenderDuration > slowRenderThreshold,
    };
  }, [slowRenderThreshold]);

  const logPerformanceIssue = useCallback((issue: string, details: Record<string, any> = {}) => {
    componentErrorCount.add(1, {
      component_name: componentName,
      issue_type: issue,
    });

    logger.emit({
      severityNumber: SeverityNumber.WARN,
      severityText: 'WARN',
      body: `Performance issue in ${componentName}: ${issue}`,
      attributes: {
        component_name: componentName,
        performance_issue: issue,
        component_render_count: renderCount.current,
        component_mount_duration_ms: Date.now() - mountTime.current,
        trace_id: componentSpan.current?.spanContext().traceId,
        span_id: componentSpan.current?.spanContext().spanId,
        ...details,
        ...metadata,
      },
    });

    if (componentSpan.current) {
      componentSpan.current.addEvent('performance_issue', {
        issue_type: issue,
        ...details,
      });
    }
  }, [componentName, metadata]);

  const trackOperation = useCallback(async <T>(
    operationName: string,
    operation: () => T | Promise<T>
  ): Promise<T> => {
    const span = tracer.startSpan(`component.operation.${operationName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'component.name': componentName,
        'component.operation': operationName,
        'component.render_count': renderCount.current,
      },
    });

    const startTime = Date.now();

    try {
      const result = await operation();
      const duration = Date.now() - startTime;

      span.setAttributes({
        'operation.duration_ms': duration,
        'operation.success': true,
      });

      componentLifecycleDuration.record(duration, {
        component_name: componentName,
        lifecycle_event: `operation_${operationName}`,
      });

      if (duration > slowRenderThreshold) {
        logger.emit({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: `Slow operation in ${componentName}: ${operationName}`,
          attributes: {
            component_name: componentName,
            operation_name: operationName,
            operation_duration_ms: duration,
            trace_id: span.spanContext().traceId,
            span_id: span.spanContext().spanId,
          },
        });
      }

      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      span.setAttributes({
        'operation.duration_ms': duration,
        'operation.success': false,
        'operation.error': (error as Error).message,
      });

      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Operation failed: ${operationName}`,
      });

      componentErrorCount.add(1, {
        component_name: componentName,
        issue_type: `operation_error_${operationName}`,
      });

      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: `Operation failed in ${componentName}: ${operationName}`,
        attributes: {
          component_name: componentName,
          operation_name: operationName,
          operation_duration_ms: duration,
          error: (error as Error).message,
          trace_id: span.spanContext().traceId,
          span_id: span.spanContext().spanId,
        },
      });

      throw error;
    } finally {
      span.end();
    }
  }, [componentName, slowRenderThreshold]);

  // Prop change tracking
  useEffect(() => {
    if (!trackPropChanges) return;

    // This would need to be implemented with the actual props
    // For now, we just log that prop tracking is enabled
    if (componentSpan.current) {
      componentSpan.current.addEvent('prop_tracking_enabled');
    }
  }, [trackPropChanges]);

  return useMemo(() => ({
    startRender,
    endRender,
    getMetrics,
    logPerformanceIssue,
    trackOperation,
  }), [startRender, endRender, getMetrics, logPerformanceIssue, trackOperation]);
}

/**
 * Simplified hook for basic render time tracking.
 * Provides a lightweight alternative when you only need basic render metrics.
 * 
 * @example
 * ```tsx
 * function SimpleComponent() {
 *   const renderTime = useRenderTime('SimpleComponent');
 *   
 *   return <div>Last render: {renderTime}ms</div>;
 * }
 * ```
 */
export function useRenderTime(componentName: string): number {
  const renderStartTime = useRef<number>(Date.now());
  const lastRenderTime = useRef<number>(0);

  useEffect(() => {
    lastRenderTime.current = Date.now() - renderStartTime.current;
    renderStartTime.current = Date.now();

    componentRenderDuration.record(lastRenderTime.current, {
      component_name: componentName,
      render_type: 'tracked',
      tracking_type: 'simple',
    });
  });

  return lastRenderTime.current;
}

export default useComponentPerformance;