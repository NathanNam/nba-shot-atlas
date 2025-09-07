import { useCallback } from 'react';
import { trace, SpanStatusCode, SpanKind, context } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

// Metrics for API tracking
const apiCallsTotal = meter.createCounter('api_calls_total', {
  description: 'Total number of API calls made by the application',
});

const apiCallDuration = meter.createHistogram('api_call_duration_ms', {
  description: 'Duration of API calls in milliseconds',
  unit: 'ms',
});

const apiResponseSize = meter.createHistogram('api_response_size_bytes', {
  description: 'Size of API responses in bytes',
  unit: 'By',
});

const apiErrorsTotal = meter.createCounter('api_errors_total', {
  description: 'Total number of API errors by status code',
});

const apiRetryCount = meter.createCounter('api_retries_total', {
  description: 'Total number of API retry attempts',
});

const activeApiCalls = meter.createUpDownCounter('api_calls_active', {
  description: 'Number of currently active API calls',
});

interface APICallOptions {
  /** The service/endpoint being called (e.g., 'nba-api', 'supabase') */
  service: string;
  /** The specific endpoint or operation (e.g., 'get-player-stats', 'shots-data') */
  operation: string;
  /** HTTP method for REST APIs */
  method?: string;
  /** Expected response format */
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer';
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Cache key if the call is cacheable */
  cacheKey?: string;
  /** Additional context attributes for the span */
  attributes?: Record<string, string | number | boolean>;
}

interface APICallResult<T> {
  /** The response data */
  data: T;
  /** Response time in milliseconds */
  duration: number;
  /** Whether the response came from cache */
  cached: boolean;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Response size in bytes if available */
  responseSize?: number;
}

interface APIError extends Error {
  statusCode?: number;
  response?: any;
  retryCount: number;
}

/**
 * Enhanced hook for tracking API calls with comprehensive OpenTelemetry instrumentation.
 * Provides automatic tracing, logging, metrics collection, and error handling for API calls.
 * 
 * @example
 * ```tsx
 * function PlayerStats({ playerId }: { playerId: string }) {
 *   const trackApiCall = useAPITracking();
 *   
 *   const [stats, setStats] = useState(null);
 *   const [loading, setLoading] = useState(false);
 *   
 *   useEffect(() => {
 *     const fetchStats = async () => {
 *       setLoading(true);
 *       try {
 *         const result = await trackApiCall(
 *           () => fetch(`/api/players/${playerId}/stats`).then(r => r.json()),
 *           {
 *             service: 'nba-api',
 *             operation: 'get-player-stats',
 *             method: 'GET',
 *             attributes: { player_id: playerId }
 *           }
 *         );
 *         setStats(result.data);
 *       } finally {
 *         setLoading(false);
 *       }
 *     };
 *     
 *     fetchStats();
 *   }, [playerId, trackApiCall]);
 *   
 *   return <div>{loading ? 'Loading...' : JSON.stringify(stats)}</div>;
 * }
 * ```
 */
export function useAPITracking() {
  const trackApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    options: APICallOptions
  ): Promise<APICallResult<T>> => {
    const {
      service,
      operation,
      method = 'unknown',
      responseType = 'json',
      maxRetries = 3,
      cacheKey,
      attributes = {}
    } = options;

    const spanName = `${service}.${operation}`;
    const span = tracer.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      attributes: {
        'api.service': service,
        'api.operation': operation,
        'api.method': method,
        'api.response_type': responseType,
        'api.max_retries': maxRetries,
        'api.cache_key': cacheKey || 'none',
        ...Object.fromEntries(
          Object.entries(attributes).map(([k, v]) => [`api.${k}`, v])
        ),
      },
    });

    const startTime = Date.now();
    let retryCount = 0;
    let cached = false;
    let responseSize: number | undefined;
    let statusCode: number | undefined;

    // Increment active calls counter
    activeApiCalls.add(1, {
      service,
      operation,
    });

    // Record the start of the API call
    apiCallsTotal.add(1, {
      service,
      operation,
      method,
      type: 'started',
    });

    logger.emit({
      severityNumber: SeverityNumber.DEBUG,
      severityText: 'DEBUG',
      body: `Starting API call: ${service}.${operation}`,
      attributes: {
        api_service: service,
        api_operation: operation,
        api_method: method,
        api_cache_key: cacheKey,
        trace_id: span.spanContext().traceId,
        span_id: span.spanContext().spanId,
        ...attributes,
      },
    });

    try {
      let result: T;
      let lastError: APIError | undefined;

      // Retry logic
      while (retryCount <= maxRetries) {
        try {
          const callStart = Date.now();
          
          result = await apiCall();
          
          const callDuration = Date.now() - callStart;

          // Try to extract metadata from the response
          if (result && typeof result === 'object') {
            // Check if it's a Response object
            if ('status' in result && 'headers' in result) {
              const response = result as any;
              statusCode = response.status;
              
              // Try to get content-length header
              if (response.headers && response.headers.get) {
                const contentLength = response.headers.get('content-length');
                if (contentLength) {
                  responseSize = parseInt(contentLength, 10);
                }
              }
            }
            
            // Estimate size for JSON responses
            if (responseType === 'json' && !responseSize) {
              try {
                responseSize = new TextEncoder().encode(JSON.stringify(result)).length;
              } catch {
                // Ignore encoding errors
              }
            }
          }

          span.setAttributes({
            'api.retry_count': retryCount,
            'api.status_code': statusCode || 200,
            'api.response_size_bytes': responseSize || 0,
            'api.cached': cached,
            'api.call_duration_ms': callDuration,
          });

          // Record successful API call metrics
          apiCallDuration.record(Date.now() - startTime, {
            service,
            operation,
            method,
            status: 'success',
            retry_count: retryCount.toString(),
          });

          if (responseSize) {
            apiResponseSize.record(responseSize, {
              service,
              operation,
              method,
            });
          }

          if (retryCount > 0) {
            apiRetryCount.add(retryCount, {
              service,
              operation,
              final_result: 'success',
            });

            logger.emit({
              severityNumber: SeverityNumber.INFO,
              severityText: 'INFO',
              body: `API call succeeded after ${retryCount} retries`,
              attributes: {
                api_service: service,
                api_operation: operation,
                retry_count: retryCount,
                final_duration_ms: Date.now() - startTime,
                trace_id: span.spanContext().traceId,
                span_id: span.spanContext().spanId,
              },
            });
          }

          logger.emit({
            severityNumber: SeverityNumber.INFO,
            severityText: 'INFO',
            body: `API call completed successfully: ${service}.${operation}`,
            attributes: {
              api_service: service,
              api_operation: operation,
              api_method: method,
              api_status_code: statusCode || 200,
              api_response_size_bytes: responseSize || 0,
              api_duration_ms: Date.now() - startTime,
              api_cached: cached,
              api_retry_count: retryCount,
              trace_id: span.spanContext().traceId,
              span_id: span.spanContext().spanId,
            },
          });

          span.setStatus({ code: SpanStatusCode.OK });
          break; // Success, exit retry loop

        } catch (error) {
          retryCount++;
          lastError = error as APIError;
          lastError.retryCount = retryCount - 1;

          // Extract status code from error if available
          if (lastError.response && lastError.response.status) {
            statusCode = lastError.response.status;
          }

          span.recordException(lastError);
          span.setAttributes({
            'api.error': lastError.message,
            'api.error_type': lastError.constructor.name,
            'api.retry_count': retryCount - 1,
            'api.status_code': statusCode || 0,
          });

          // Record error metrics
          apiErrorsTotal.add(1, {
            service,
            operation,
            method,
            error_type: lastError.constructor.name,
            status_code: statusCode ? statusCode.toString() : 'unknown',
            retry_count: (retryCount - 1).toString(),
          });

          logger.emit({
            severityNumber: retryCount > maxRetries ? SeverityNumber.ERROR : SeverityNumber.WARN,
            severityText: retryCount > maxRetries ? 'ERROR' : 'WARN',
            body: `API call failed (attempt ${retryCount}/${maxRetries + 1}): ${service}.${operation}`,
            attributes: {
              api_service: service,
              api_operation: operation,
              api_method: method,
              api_error: lastError.message,
              api_error_type: lastError.constructor.name,
              api_status_code: statusCode || 0,
              api_retry_count: retryCount - 1,
              api_will_retry: retryCount <= maxRetries,
              trace_id: span.spanContext().traceId,
              span_id: span.spanContext().spanId,
            },
          });

          if (retryCount > maxRetries) {
            // Final failure after all retries
            apiRetryCount.add(retryCount - 1, {
              service,
              operation,
              final_result: 'failure',
            });

            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `API call failed after ${retryCount - 1} retries: ${lastError.message}`,
            });

            throw lastError;
          }

          // Wait before retrying (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));

          logger.emit({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: `Retrying API call after ${delay}ms delay`,
            attributes: {
              api_service: service,
              api_operation: operation,
              retry_attempt: retryCount,
              delay_ms: delay,
              trace_id: span.spanContext().traceId,
              span_id: span.spanContext().spanId,
            },
          });
        }
      }

      // Record final success metrics
      apiCallsTotal.add(1, {
        service,
        operation,
        method,
        type: 'completed',
        status: 'success',
      });

      return {
        data: result!,
        duration: Date.now() - startTime,
        cached,
        statusCode,
        responseSize,
      };

    } finally {
      // Always decrement active calls counter
      activeApiCalls.add(-1, {
        service,
        operation,
      });

      span.end();
    }
  }, []);

  return trackApiCall;
}

/**
 * Simplified hook for tracking data fetching operations specifically.
 * Provides a more convenient interface for common data loading patterns.
 * 
 * @example
 * ```tsx
 * function usePlayerStats(playerId: string) {
 *   const [data, setData] = useState(null);
 *   const [loading, setLoading] = useState(false);
 *   const [error, setError] = useState(null);
 *   const trackDataFetch = useDataFetchTracking();
 *   
 *   useEffect(() => {
 *     if (!playerId) return;
 *     
 *     setLoading(true);
 *     setError(null);
 *     
 *     trackDataFetch({
 *       operation: 'fetch-player-stats',
 *       fetcher: () => fetch(`/api/players/${playerId}/stats`).then(r => r.json()),
 *       onSuccess: setData,
 *       onError: setError,
 *       onComplete: () => setLoading(false),
 *       metadata: { player_id: playerId }
 *     });
 *   }, [playerId, trackDataFetch]);
 *   
 *   return { data, loading, error };
 * }
 * ```
 */
export function useDataFetchTracking() {
  const trackApiCall = useAPITracking();

  const trackDataFetch = useCallback(async <T>(options: {
    /** Operation name for tracking */
    operation: string;
    /** Function that returns the data */
    fetcher: () => Promise<T>;
    /** Called with the fetched data on success */
    onSuccess?: (data: T, result: APICallResult<T>) => void;
    /** Called with the error on failure */
    onError?: (error: APIError) => void;
    /** Always called after the operation completes */
    onComplete?: () => void;
    /** Additional metadata for tracing */
    metadata?: Record<string, string | number | boolean>;
    /** Service name (defaults to 'data-fetch') */
    service?: string;
  }) => {
    const {
      operation,
      fetcher,
      onSuccess,
      onError,
      onComplete,
      metadata = {},
      service = 'data-fetch'
    } = options;

    try {
      const result = await trackApiCall(fetcher, {
        service,
        operation,
        attributes: metadata,
      });

      onSuccess?.(result.data, result);
      return result;
    } catch (error) {
      onError?.(error as APIError);
      throw error;
    } finally {
      onComplete?.();
    }
  }, [trackApiCall]);

  return trackDataFetch;
}

export default useAPITracking;