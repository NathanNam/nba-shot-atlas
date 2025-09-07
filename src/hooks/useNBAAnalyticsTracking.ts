import { useCallback, useEffect } from 'react';
import { trace, SpanStatusCode, context } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

// Metrics for NBA analytics operations
const comparisonCounter = meter.createCounter('nba_comparison_operations_total', {
  description: 'Total number of comparison operations performed',
});

const comparisonDurationHistogram = meter.createHistogram('nba_comparison_duration_seconds', {
  description: 'Duration of comparison calculations',
  unit: 's',
});

const dataLoadCounter = meter.createCounter('nba_data_load_operations_total', {
  description: 'Total number of data loading operations',
});

const userEngagementCounter = meter.createCounter('nba_user_engagement_events_total', {
  description: 'Total number of user engagement events',
});

export interface ComparisonMetadata {
  entityType: 'player' | 'team' | 'league';
  comparisonType: 'season' | 'entity' | 'multiEntity';
  entityCount: number;
  seasonCount: number;
  dataPointsCompared: number;
}

export interface DataLoadMetadata {
  entityType: 'player' | 'team' | 'league';
  season: string;
  dataSource: 'cache' | 'api' | 'supabase';
  recordCount: number;
  cacheHit: boolean;
}

export interface UserEngagementMetadata {
  action: 'view' | 'compare' | 'filter' | 'export' | 'share';
  component: string;
  entityType?: 'player' | 'team' | 'league';
  duration?: number;
}

export function useNBAAnalyticsTracking() {
  // Track comparison usage with detailed metrics
  const trackComparison = useCallback(
    (operation: string, metadata: ComparisonMetadata, executeFn?: () => Promise<any> | any) => {
      const span = tracer.startSpan(`nba.comparison.${operation}`, {
        attributes: {
          'nba.comparison.entity_type': metadata.entityType,
          'nba.comparison.type': metadata.comparisonType,
          'nba.comparison.entity_count': metadata.entityCount,
          'nba.comparison.season_count': metadata.seasonCount,
          'nba.comparison.data_points': metadata.dataPointsCompared,
        },
      });

      return context.with(trace.setSpan(context.active(), span), async () => {
        const startTime = Date.now();
        
        try {
          // Log the comparison start
          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `Starting NBA comparison operation: ${operation}`,
            attributes: {
              'operation': operation,
              'entity_type': metadata.entityType,
              'comparison_type': metadata.comparisonType,
              'entity_count': metadata.entityCount,
              'season_count': metadata.seasonCount,
              'data_points': metadata.dataPointsCompared,
              'trace_id': span.spanContext().traceId,
              'span_id': span.spanContext().spanId,
            },
          });

          // Execute the function if provided
          const result = executeFn ? await executeFn() : undefined;
          
          const duration = (Date.now() - startTime) / 1000;
          
          // Record metrics
          comparisonCounter.add(1, {
            operation,
            entity_type: metadata.entityType,
            comparison_type: metadata.comparisonType,
          });
          
          comparisonDurationHistogram.record(duration, {
            operation,
            entity_type: metadata.entityType,
            comparison_type: metadata.comparisonType,
          });

          // Set span attributes for successful completion
          span.setAttributes({
            'nba.comparison.duration_ms': Date.now() - startTime,
            'nba.comparison.success': true,
            'nba.comparison.result_count': result?.length || 0,
          });
          
          span.setStatus({ code: SpanStatusCode.OK });
          
          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `Completed NBA comparison operation: ${operation}`,
            attributes: {
              'operation': operation,
              'duration_ms': Date.now() - startTime,
              'success': true,
              'result_count': result?.length || 0,
              'trace_id': span.spanContext().traceId,
              'span_id': span.spanContext().spanId,
            },
          });

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const duration = (Date.now() - startTime) / 1000;
          
          // Record error metrics
          comparisonCounter.add(1, {
            operation,
            entity_type: metadata.entityType,
            comparison_type: metadata.comparisonType,
            status: 'error',
          });
          
          comparisonDurationHistogram.record(duration, {
            operation,
            entity_type: metadata.entityType,
            comparison_type: metadata.comparisonType,
            status: 'error',
          });

          // Set span error status
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });

          span.setAttributes({
            'nba.comparison.duration_ms': Date.now() - startTime,
            'nba.comparison.success': false,
            'nba.comparison.error': errorMessage,
          });

          logger.emit({
            severityNumber: SeverityNumber.ERROR,
            severityText: 'ERROR',
            body: `Failed NBA comparison operation: ${operation}`,
            attributes: {
              'operation': operation,
              'error': errorMessage,
              'duration_ms': Date.now() - startTime,
              'success': false,
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
    []
  );

  // Track data loading operations
  const trackDataLoad = useCallback(
    (operation: string, metadata: DataLoadMetadata, executeFn?: () => Promise<any> | any) => {
      const span = tracer.startSpan(`nba.data.${operation}`, {
        attributes: {
          'nba.data.entity_type': metadata.entityType,
          'nba.data.season': metadata.season,
          'nba.data.source': metadata.dataSource,
          'nba.data.cache_hit': metadata.cacheHit,
          'nba.data.record_count': metadata.recordCount,
        },
      });

      return context.with(trace.setSpan(context.active(), span), async () => {
        const startTime = Date.now();
        
        try {
          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `Starting NBA data load operation: ${operation}`,
            attributes: {
              'operation': operation,
              'entity_type': metadata.entityType,
              'season': metadata.season,
              'data_source': metadata.dataSource,
              'cache_hit': metadata.cacheHit,
              'record_count': metadata.recordCount,
              'trace_id': span.spanContext().traceId,
              'span_id': span.spanContext().spanId,
            },
          });

          const result = executeFn ? await executeFn() : undefined;
          const duration = (Date.now() - startTime) / 1000;
          
          // Record metrics
          dataLoadCounter.add(1, {
            operation,
            entity_type: metadata.entityType,
            data_source: metadata.dataSource,
            cache_hit: metadata.cacheHit.toString(),
          });

          span.setAttributes({
            'nba.data.duration_ms': Date.now() - startTime,
            'nba.data.success': true,
            'nba.data.loaded_count': result?.length || metadata.recordCount,
          });
          
          span.setStatus({ code: SpanStatusCode.OK });

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          dataLoadCounter.add(1, {
            operation,
            entity_type: metadata.entityType,
            data_source: metadata.dataSource,
            status: 'error',
          });

          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });

          span.setAttributes({
            'nba.data.duration_ms': Date.now() - startTime,
            'nba.data.success': false,
            'nba.data.error': errorMessage,
          });

          logger.emit({
            severityNumber: SeverityNumber.ERROR,
            severityText: 'ERROR',
            body: `Failed NBA data load operation: ${operation}`,
            attributes: {
              'operation': operation,
              'error': errorMessage,
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
    []
  );

  // Track user engagement events
  const trackUserEngagement = useCallback(
    (metadata: UserEngagementMetadata) => {
      const span = tracer.startSpan(`nba.user.${metadata.action}`, {
        attributes: {
          'nba.user.action': metadata.action,
          'nba.user.component': metadata.component,
          'nba.user.entity_type': metadata.entityType || 'unknown',
          'nba.user.duration': metadata.duration || 0,
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        try {
          // Record engagement metrics
          userEngagementCounter.add(1, {
            action: metadata.action,
            component: metadata.component,
            entity_type: metadata.entityType || 'unknown',
          });

          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `User engagement: ${metadata.action} in ${metadata.component}`,
            attributes: {
              'action': metadata.action,
              'component': metadata.component,
              'entity_type': metadata.entityType || 'unknown',
              'duration': metadata.duration || 0,
              'trace_id': span.spanContext().traceId,
              'span_id': span.spanContext().spanId,
            },
          });

          span.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        } finally {
          span.end();
        }
      });
    },
    []
  );

  // Track component mount/unmount for usage analytics
  const trackComponentLifecycle = useCallback(
    (componentName: string, action: 'mount' | 'unmount', metadata?: Record<string, any>) => {
      const span = tracer.startSpan(`nba.component.${action}`, {
        attributes: {
          'nba.component.name': componentName,
          'nba.component.action': action,
          ...metadata,
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        logger.emit({
          severityNumber: SeverityNumber.DEBUG,
          severityText: 'DEBUG',
          body: `Component ${action}: ${componentName}`,
          attributes: {
            'component': componentName,
            'action': action,
            'trace_id': span.spanContext().traceId,
            'span_id': span.spanContext().spanId,
            ...metadata,
          },
        });

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      });
    },
    []
  );

  return {
    trackComparison,
    trackDataLoad,
    trackUserEngagement,
    trackComponentLifecycle,
  };
}