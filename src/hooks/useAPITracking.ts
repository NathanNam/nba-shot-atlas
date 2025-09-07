import { useCallback } from 'react';
import { trace, SpanStatusCode, context, SpanKind } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

// Metrics for API tracking
const apiRequestCounter = meter.createCounter('nba_api_requests_total', {
  description: 'Total number of API requests',
});

const apiRequestDurationHistogram = meter.createHistogram('nba_api_request_duration_seconds', {
  description: 'Duration of API requests',
  unit: 's',
});

const apiErrorCounter = meter.createCounter('nba_api_errors_total', {
  description: 'Total number of API errors',
});

const cacheHitCounter = meter.createCounter('nba_cache_hits_total', {
  description: 'Total number of cache hits',
});

const dataFreshnessGauge = meter.createHistogram('nba_data_freshness_seconds', {
  description: 'Age of cached data in seconds',
  unit: 's',
});

export interface APICallMetadata {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  service: 'nba-api' | 'supabase' | 'cache' | 'local';
  entityType?: 'player' | 'team' | 'league';
  entityId?: string;
  season?: string;
  cacheKey?: string;
  retryAttempt?: number;
  expectedResponseSize?: number;
}

export interface CacheMetadata {
  key: string;
  hit: boolean;
  ttl?: number;
  size?: number;
  age?: number; // in seconds
}

export function useAPITracking() {
  // Track API calls with comprehensive metrics
  const trackAPICall = useCallback(
    async <T>(
      operation: string,
      metadata: APICallMetadata,
      executeFn: () => Promise<T>
    ): Promise<T> => {
      const span = tracer.startSpan(`api.${metadata.service}.${operation}`, {
        kind: SpanKind.CLIENT,
        attributes: {
          'http.method': metadata.method,
          'http.url': metadata.endpoint,
          'service.name': metadata.service,
          'nba.entity.type': metadata.entityType || 'unknown',
          'nba.entity.id': metadata.entityId || 'unknown',
          'nba.season': metadata.season || 'unknown',
          'nba.cache.key': metadata.cacheKey || '',
          'retry.attempt': metadata.retryAttempt || 0,
        },
      });

      return context.with(trace.setSpan(context.active(), span), async () => {
        const startTime = Date.now();
        
        try {
          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `Starting API call: ${operation}`,
            attributes: {
              'operation': operation,
              'method': metadata.method,
              'endpoint': metadata.endpoint,
              'service': metadata.service,
              'entity_type': metadata.entityType || 'unknown',
              'entity_id': metadata.entityId || 'unknown',
              'season': metadata.season || 'unknown',
              'cache_key': metadata.cacheKey || '',
              'retry_attempt': metadata.retryAttempt || 0,
              'trace_id': span.spanContext().traceId,
              'span_id': span.spanContext().spanId,
            },
          });

          const result = await executeFn();
          const duration = (Date.now() - startTime) / 1000;
          
          // Record success metrics
          apiRequestCounter.add(1, {
            operation,
            service: metadata.service,
            method: metadata.method,
            entity_type: metadata.entityType || 'unknown',
            status: 'success',
          });
          
          apiRequestDurationHistogram.record(duration, {
            operation,
            service: metadata.service,
            method: metadata.method,
            entity_type: metadata.entityType || 'unknown',
          });

          // Calculate response size if possible
          let responseSize = 0;
          if (Array.isArray(result)) {
            responseSize = result.length;
          } else if (typeof result === 'object' && result !== null) {
            responseSize = JSON.stringify(result).length;
          }

          span.setAttributes({
            'http.status_code': 200,
            'http.response.body.size': responseSize,
            'nba.response.record_count': Array.isArray(result) ? result.length : 1,
            'nba.api.duration_ms': Date.now() - startTime,
            'nba.api.success': true,
          });
          
          span.setStatus({ code: SpanStatusCode.OK });
          
          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `Completed API call: ${operation}`,
            attributes: {
              'operation': operation,
              'duration_ms': Date.now() - startTime,
              'response_size': responseSize,
              'record_count': Array.isArray(result) ? result.length : 1,
              'success': true,
              'trace_id': span.spanContext().traceId,
              'span_id': span.spanContext().spanId,
            },
          });

          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const duration = (Date.now() - startTime) / 1000;
          
          // Record error metrics
          apiRequestCounter.add(1, {
            operation,
            service: metadata.service,
            method: metadata.method,
            entity_type: metadata.entityType || 'unknown',
            status: 'error',
          });
          
          apiErrorCounter.add(1, {
            operation,
            service: metadata.service,
            error_type: error instanceof Error ? error.constructor.name : 'unknown',
            entity_type: metadata.entityType || 'unknown',
          });
          
          apiRequestDurationHistogram.record(duration, {
            operation,
            service: metadata.service,
            method: metadata.method,
            entity_type: metadata.entityType || 'unknown',
            status: 'error',
          });

          // Handle different error types
          let statusCode = 500;
          if (error instanceof TypeError && error.message.includes('fetch')) {
            statusCode = 0; // Network error
          } else if ('status' in (error as any)) {
            statusCode = (error as any).status;
          }

          span.setAttributes({
            'http.status_code': statusCode,
            'nba.api.duration_ms': Date.now() - startTime,
            'nba.api.success': false,
            'nba.api.error': errorMessage,
            'nba.api.error_type': error instanceof Error ? error.constructor.name : 'unknown',
          });

          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errorMessage,
          });

          logger.emit({
            severityNumber: SeverityNumber.ERROR,
            severityText: 'ERROR',
            body: `Failed API call: ${operation}`,
            attributes: {
              'operation': operation,
              'error': errorMessage,
              'error_type': error instanceof Error ? error.constructor.name : 'unknown',
              'status_code': statusCode,
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

  // Track cache operations
  const trackCacheOperation = useCallback(
    (operation: 'hit' | 'miss' | 'set' | 'delete' | 'expire', metadata: CacheMetadata) => {
      const span = tracer.startSpan(`cache.${operation}`, {
        attributes: {
          'cache.key': metadata.key,
          'cache.hit': metadata.hit,
          'cache.ttl': metadata.ttl || 0,
          'cache.size': metadata.size || 0,
          'cache.age': metadata.age || 0,
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        try {
          // Record cache metrics
          if (operation === 'hit' || operation === 'miss') {
            cacheHitCounter.add(1, {
              operation,
              cache_key: metadata.key,
              result: metadata.hit ? 'hit' : 'miss',
            });
          }

          if (metadata.age !== undefined) {
            dataFreshnessGauge.record(metadata.age, {
              cache_key: metadata.key,
            });
          }

          logger.emit({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `Cache ${operation}: ${metadata.key}`,
            attributes: {
              'cache_operation': operation,
              'cache_key': metadata.key,
              'cache_hit': metadata.hit,
              'cache_ttl': metadata.ttl || 0,
              'cache_size': metadata.size || 0,
              'cache_age': metadata.age || 0,
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

  // Track service health/availability
  const trackServiceHealth = useCallback(
    (service: string, status: 'healthy' | 'degraded' | 'unhealthy', metadata?: Record<string, any>) => {
      const span = tracer.startSpan(`service.health.${service}`, {
        attributes: {
          'service.name': service,
          'service.status': status,
          ...(metadata || {}),
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        logger.emit({
          severityNumber: status === 'unhealthy' ? SeverityNumber.ERROR : 
                        status === 'degraded' ? SeverityNumber.WARN : SeverityNumber.INFO,
          severityText: status === 'unhealthy' ? 'ERROR' : 
                       status === 'degraded' ? 'WARN' : 'INFO',
          body: `Service health check: ${service} is ${status}`,
          attributes: {
            'service': service,
            'status': status,
            'trace_id': span.spanContext().traceId,
            'span_id': span.spanContext().spanId,
            ...(metadata || {}),
          },
        });

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      });
    },
    []
  );

  // Track data quality metrics
  const trackDataQuality = useCallback(
    (operation: string, metadata: {
      recordCount: number;
      nullCount?: number;
      duplicateCount?: number;
      validationErrors?: string[];
      dataSource: string;
      entityType?: string;
    }) => {
      const span = tracer.startSpan(`data.quality.${operation}`, {
        attributes: {
          'data.source': metadata.dataSource,
          'data.entity_type': metadata.entityType || 'unknown',
          'data.record_count': metadata.recordCount,
          'data.null_count': metadata.nullCount || 0,
          'data.duplicate_count': metadata.duplicateCount || 0,
          'data.validation_error_count': metadata.validationErrors?.length || 0,
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        const severity = metadata.validationErrors?.length ? SeverityNumber.WARN : SeverityNumber.INFO;
        
        logger.emit({
          severityNumber: severity,
          severityText: severity === SeverityNumber.WARN ? 'WARN' : 'INFO',
          body: `Data quality check: ${operation}`,
          attributes: {
            'operation': operation,
            'data_source': metadata.dataSource,
            'entity_type': metadata.entityType || 'unknown',
            'record_count': metadata.recordCount,
            'null_count': metadata.nullCount || 0,
            'duplicate_count': metadata.duplicateCount || 0,
            'validation_errors': metadata.validationErrors?.join(', ') || '',
            'trace_id': span.spanContext().traceId,
            'span_id': span.spanContext().spanId,
          },
        });

        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      });
    },
    []
  );

  return {
    trackAPICall,
    trackCacheOperation,
    trackServiceHealth,
    trackDataQuality,
  };
}