import { useCallback, useEffect, useRef } from 'react';
import { trace, SpanStatusCode, context } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

// Metrics for component performance
const componentRenderDurationHistogram = meter.createHistogram('nba_component_render_duration_seconds', {
  description: 'Duration of component renders',
  unit: 's',
});

const componentMountCounter = meter.createCounter('nba_component_mounts_total', {
  description: 'Total number of component mounts',
});

const componentErrorCounter = meter.createCounter('nba_component_errors_total', {
  description: 'Total number of component errors',
});

const memoryUsageGauge = meter.createHistogram('nba_component_memory_usage_bytes', {
  description: 'Memory usage by component',
  unit: 'bytes',
});

const reRenderCounter = meter.createCounter('nba_component_rerenders_total', {
  description: 'Total number of component re-renders',
});

export interface ComponentPerformanceMetadata {
  componentName: string;
  props?: Record<string, any>;
  renderTrigger?: 'mount' | 'props_change' | 'state_change' | 'parent_rerender' | 'force_update';
  dataSize?: number;
  isHeavyComputation?: boolean;
}

export interface RenderMetrics {
  duration: number;
  timestamp: number;
  renderCount: number;
  memoryUsage?: number;
}

export function useComponentPerformance(componentName: string, metadata?: ComponentPerformanceMetadata) {
  const renderCount = useRef<number>(0);
  const mountTime = useRef<number>(Date.now());
  const lastRenderTime = useRef<number>(Date.now());
  const renderStartTime = useRef<number | null>(null);

  // Track component mount
  useEffect(() => {
    const span = tracer.startSpan(`component.mount.${componentName}`, {
      attributes: {
        'component.name': componentName,
        'component.mount_time': mountTime.current,
        'component.props': JSON.stringify(metadata?.props || {}),
      },
    });

    context.with(trace.setSpan(context.active(), span), () => {
      componentMountCounter.add(1, {
        component: componentName,
      });

      logger.emit({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: `Component mounted: ${componentName}`,
        attributes: {
          'component': componentName,
          'mount_time': mountTime.current,
          'props': JSON.stringify(metadata?.props || {}),
          'trace_id': span.spanContext().traceId,
          'span_id': span.spanContext().spanId,
        },
      });

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    });

    // Track component unmount
    return () => {
      const lifetimeDuration = (Date.now() - mountTime.current) / 1000;
      
      const unmountSpan = tracer.startSpan(`component.unmount.${componentName}`, {
        attributes: {
          'component.name': componentName,
          'component.lifetime_duration': lifetimeDuration,
          'component.total_renders': renderCount.current,
        },
      });

      context.with(trace.setSpan(context.active(), unmountSpan), () => {
        logger.emit({
          severityNumber: SeverityNumber.DEBUG,
          severityText: 'DEBUG',
          body: `Component unmounted: ${componentName}`,
          attributes: {
            'component': componentName,
            'lifetime_duration': lifetimeDuration,
            'total_renders': renderCount.current,
            'trace_id': unmountSpan.spanContext().traceId,
            'span_id': unmountSpan.spanContext().spanId,
          },
        });

        unmountSpan.setStatus({ code: SpanStatusCode.OK });
        unmountSpan.end();
      });
    };
  }, [componentName, metadata?.props]);

  // Start render timing
  const startRenderTracking = useCallback(() => {
    renderStartTime.current = Date.now();
    return renderStartTime.current;
  }, []);

  // End render timing and record metrics
  const endRenderTracking = useCallback(
    (renderTrigger?: string, additionalMetadata?: Record<string, any>) => {
      if (renderStartTime.current === null) return;

      const renderDuration = (Date.now() - renderStartTime.current) / 1000;
      renderCount.current++;
      lastRenderTime.current = Date.now();

      const span = tracer.startSpan(`component.render.${componentName}`, {
        attributes: {
          'component.name': componentName,
          'component.render.duration': renderDuration,
          'component.render.count': renderCount.current,
          'component.render.trigger': renderTrigger || 'unknown',
          'component.data_size': metadata?.dataSize || 0,
          'component.heavy_computation': metadata?.isHeavyComputation || false,
          ...(additionalMetadata || {}),
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        // Record performance metrics
        componentRenderDurationHistogram.record(renderDuration, {
          component: componentName,
          render_trigger: renderTrigger || 'unknown',
        });

        if (renderCount.current > 1) {
          reRenderCounter.add(1, {
            component: componentName,
            render_trigger: renderTrigger || 'unknown',
          });
        }

        // Try to get memory usage if available
        let memoryUsage = 0;
        if ('memory' in performance && 'usedJSHeapSize' in (performance as any).memory) {
          memoryUsage = (performance as any).memory.usedJSHeapSize;
          memoryUsageGauge.record(memoryUsage, {
            component: componentName,
          });
        }

        const logLevel = renderDuration > 0.1 ? SeverityNumber.WARN : SeverityNumber.DEBUG;
        
        logger.emit({
          severityNumber: logLevel,
          severityText: logLevel === SeverityNumber.WARN ? 'WARN' : 'DEBUG',
          body: `Component rendered: ${componentName} (${renderDuration.toFixed(3)}s)`,
          attributes: {
            'component': componentName,
            'render_duration': renderDuration,
            'render_count': renderCount.current,
            'render_trigger': renderTrigger || 'unknown',
            'data_size': metadata?.dataSize || 0,
            'heavy_computation': metadata?.isHeavyComputation || false,
            'memory_usage': memoryUsage,
            'trace_id': span.spanContext().traceId,
            'span_id': span.spanContext().spanId,
            ...(additionalMetadata || {}),
          },
        });

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      });

      renderStartTime.current = null;
      return renderDuration;
    },
    [componentName, metadata]
  );

  // Track component errors
  const trackComponentError = useCallback(
    (error: Error, errorInfo?: any) => {
      const span = tracer.startSpan(`component.error.${componentName}`, {
        attributes: {
          'component.name': componentName,
          'error.message': error.message,
          'error.name': error.name,
          'error.stack': error.stack || '',
          'component.render_count': renderCount.current,
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        componentErrorCounter.add(1, {
          component: componentName,
          error_type: error.name,
        });

        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });

        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: 'ERROR',
          body: `Component error in ${componentName}: ${error.message}`,
          attributes: {
            'component': componentName,
            'error_message': error.message,
            'error_name': error.name,
            'error_stack': error.stack || '',
            'render_count': renderCount.current,
            'error_info': JSON.stringify(errorInfo || {}),
            'trace_id': span.spanContext().traceId,
            'span_id': span.spanContext().spanId,
          },
        });

        span.end();
      });
    },
    [componentName]
  );

  // Track heavy computations within components
  const trackComputation = useCallback(
    async <T>(
      computationName: string,
      executeFn: () => Promise<T> | T,
      expectedDuration?: number
    ): Promise<T> => {
      const span = tracer.startSpan(`component.computation.${componentName}.${computationName}`, {
        attributes: {
          'component.name': componentName,
          'computation.name': computationName,
          'computation.expected_duration': expectedDuration || 0,
        },
      });

      return context.with(trace.setSpan(context.active(), span), async () => {
        const startTime = Date.now();
        
        try {
          const result = await executeFn();
          const duration = (Date.now() - startTime) / 1000;

          span.setAttributes({
            'computation.duration': duration,
            'computation.success': true,
            'computation.slow': expectedDuration ? duration > expectedDuration : duration > 0.1,
          });

          const logLevel = duration > 0.1 ? SeverityNumber.WARN : SeverityNumber.DEBUG;
          
          logger.emit({
            severityNumber: logLevel,
            severityText: logLevel === SeverityNumber.WARN ? 'WARN' : 'DEBUG',
            body: `Computation completed: ${computationName} in ${componentName} (${duration.toFixed(3)}s)`,
            attributes: {
              'component': componentName,
              'computation': computationName,
              'duration': duration,
              'expected_duration': expectedDuration || 0,
              'slow': expectedDuration ? duration > expectedDuration : duration > 0.1,
              'trace_id': span.spanContext().traceId,
              'span_id': span.spanContext().spanId,
            },
          });

          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          const duration = (Date.now() - startTime) / 1000;
          
          span.setAttributes({
            'computation.duration': duration,
            'computation.success': false,
            'computation.error': error instanceof Error ? error.message : 'Unknown error',
          });

          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });

          logger.emit({
            severityNumber: SeverityNumber.ERROR,
            severityText: 'ERROR',
            body: `Computation failed: ${computationName} in ${componentName}`,
            attributes: {
              'component': componentName,
              'computation': computationName,
              'duration': duration,
              'error': error instanceof Error ? error.message : 'Unknown error',
              'trace_id': span.spanContext().traceId,
              'span_id': span.spanContext().spanId,
            },
          });

          throw error;
        } finally {
          span.end();
        }
      });
    },
    [componentName]
  );

  // Get current performance metrics
  const getPerformanceMetrics = useCallback((): RenderMetrics => {
    let memoryUsage = 0;
    if ('memory' in performance && 'usedJSHeapSize' in (performance as any).memory) {
      memoryUsage = (performance as any).memory.usedJSHeapSize;
    }

    return {
      duration: renderStartTime.current ? (Date.now() - renderStartTime.current) / 1000 : 0,
      timestamp: Date.now(),
      renderCount: renderCount.current,
      memoryUsage,
    };
  }, []);

  return {
    startRenderTracking,
    endRenderTracking,
    trackComponentError,
    trackComputation,
    getPerformanceMetrics,
    renderCount: renderCount.current,
  };
}