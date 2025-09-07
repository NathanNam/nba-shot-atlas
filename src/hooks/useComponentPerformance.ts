import { useEffect, useRef, useState } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

// Performance metrics
const componentRenderTime = meter.createHistogram('component_render_time_ms', {
  description: 'Component render time in milliseconds',
  unit: 'ms',
});

const componentMountTime = meter.createHistogram('component_mount_time_ms', {
  description: 'Component mount time in milliseconds',
  unit: 'ms',
});

const componentUpdateCounter = meter.createCounter('component_updates_total', {
  description: 'Total number of component updates',
});

const slowRenderCounter = meter.createCounter('slow_renders_total', {
  description: 'Total number of slow renders detected',
});

const memoryLeakCounter = meter.createCounter('potential_memory_leaks_total', {
  description: 'Total number of potential memory leaks detected',
});

interface PerformanceConfig {
  slowRenderThreshold?: number; // ms
  memoryLeakThreshold?: number; // MB
  trackUpdates?: boolean;
  trackMemory?: boolean;
}

interface PerformanceMetrics {
  renderTime: number;
  mountTime: number;
  updateCount: number;
  memoryUsage?: number;
  isSlowRender: boolean;
}

export function useComponentPerformance(
  componentName: string,
  config: PerformanceConfig = {}
) {
  const {
    slowRenderThreshold = 50,
    memoryLeakThreshold = 50,
    trackUpdates = true,
    trackMemory = true,
  } = config;

  const mountTime = useRef<number>(Date.now());
  const renderStartTime = useRef<number>(Date.now());
  const previousMemory = useRef<number>(0);
  const updateCount = useRef<number>(0);
  const span = useRef<any>(null);
  
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    mountTime: 0,
    updateCount: 0,
    isSlowRender: false,
  });

  // Track component mount
  useEffect(() => {
    const currentMountTime = Date.now() - mountTime.current;
    
    span.current = tracer.startSpan('component_performance.lifecycle', {
      attributes: {
        'component.name': componentName,
        'component.event': 'mount',
        'component.mount_time_ms': currentMountTime,
      },
    });

    componentMountTime.record(currentMountTime, {
      component_name: componentName,
    });

    logger.emit({
      severityNumber: currentMountTime > 100 ? SeverityNumber.WARN : SeverityNumber.DEBUG,
      severityText: currentMountTime > 100 ? 'WARN' : 'DEBUG',
      body: `Component ${componentName} mounted`,
      attributes: {
        component_name: componentName,
        mount_time_ms: currentMountTime,
        performance_tier: currentMountTime < 50 ? 'fast' : currentMountTime < 100 ? 'normal' : 'slow',
      },
    });

    // Cleanup on unmount
    return () => {
      const totalLifetime = Date.now() - mountTime.current;
      
      if (span.current) {
        span.current.setAttributes({
          'component.unmount_time': Date.now(),
          'component.total_lifetime_ms': totalLifetime,
          'component.total_updates': updateCount.current,
        });
        span.current.end();
      }

      logger.emit({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: `Component ${componentName} unmounted`,
        attributes: {
          component_name: componentName,
          total_lifetime_ms: totalLifetime,
          total_updates: updateCount.current,
        },
      });
    };
  }, [componentName]);

  // Track renders and updates
  useEffect(() => {
    const renderTime = Date.now() - renderStartTime.current;
    const isSlowRender = renderTime > slowRenderThreshold;
    
    if (trackUpdates && updateCount.current > 0) {
      componentUpdateCounter.add(1, {
        component_name: componentName,
      });
    }

    componentRenderTime.record(renderTime, {
      component_name: componentName,
      render_type: updateCount.current === 0 ? 'initial' : 'update',
    });

    if (isSlowRender) {
      slowRenderCounter.add(1, {
        component_name: componentName,
        render_type: updateCount.current === 0 ? 'initial' : 'update',
      });

      logger.emit({
        severityNumber: SeverityNumber.WARN,
        severityText: 'WARN',
        body: `Slow render detected in ${componentName}`,
        attributes: {
          component_name: componentName,
          render_time_ms: renderTime,
          render_type: updateCount.current === 0 ? 'initial' : 'update',
          update_count: updateCount.current,
        },
      });
    }

    // Track memory usage if enabled
    let memoryUsage = 0;
    if (trackMemory && 'memory' in performance) {
      const memory = (performance as any).memory;
      if (memory) {
        memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
        
        // Check for potential memory leak
        const memoryIncrease = memoryUsage - previousMemory.current;
        if (memoryIncrease > memoryLeakThreshold && updateCount.current > 10) {
          memoryLeakCounter.add(1, {
            component_name: componentName,
          });

          logger.emit({
            severityNumber: SeverityNumber.WARN,
            severityText: 'WARN',
            body: `Potential memory leak detected in ${componentName}`,
            attributes: {
              component_name: componentName,
              current_memory_mb: memoryUsage,
              previous_memory_mb: previousMemory.current,
              memory_increase_mb: memoryIncrease,
              update_count: updateCount.current,
            },
          });
        }
        
        previousMemory.current = memoryUsage;
      }
    }

    updateCount.current += 1;
    
    setMetrics({
      renderTime,
      mountTime: Date.now() - mountTime.current,
      updateCount: updateCount.current,
      memoryUsage,
      isSlowRender,
    });

    // Reset render start time for next render
    renderStartTime.current = Date.now();
  });

  const recordCustomMetric = (
    metricName: string,
    value: number,
    attributes: Record<string, string> = {}
  ) => {
    const customMetric = meter.createHistogram(`component_custom_${metricName}`, {
      description: `Custom metric: ${metricName}`,
    });

    customMetric.record(value, {
      component_name: componentName,
      ...attributes,
    });

    logger.emit({
      severityNumber: SeverityNumber.DEBUG,
      severityText: 'DEBUG',
      body: `Custom metric recorded: ${metricName}`,
      attributes: {
        component_name: componentName,
        metric_name: metricName,
        metric_value: value,
        ...attributes,
      },
    });
  };

  const startOperation = (operationName: string) => {
    const operationSpan = tracer.startSpan(`component_operation.${operationName}`, {
      attributes: {
        'component.name': componentName,
        'operation.name': operationName,
        'operation.start_time': Date.now(),
      },
    });

    return {
      end: (success: boolean = true, additionalAttributes: Record<string, any> = {}) => {
        operationSpan.setStatus({
          code: success ? SpanStatusCode.OK : SpanStatusCode.ERROR,
        });

        operationSpan.setAttributes({
          'operation.success': success,
          ...additionalAttributes,
        });

        operationSpan.end();
      },
    };
  };

  return {
    metrics,
    recordCustomMetric,
    startOperation,
  };
}