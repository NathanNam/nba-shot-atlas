import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

/**
 * Enhanced NBA Service with comprehensive OpenTelemetry instrumentation
 * 
 * Features:
 * - Comprehensive API call tracing
 * - Response time tracking and analysis
 * - Cache hit/miss monitoring
 * - Error rate tracking
 * - Retry logic monitoring
 * - Timeout tracking
 * - Data quality assessment
 * - Rate limiting compliance
 */

// Metrics
const apiCallCounter = meter.createCounter('nba_service_api_calls_total', {
  description: 'Total number of NBA service API calls',
});

const apiCallDuration = meter.createHistogram('nba_service_api_call_duration_ms', {
  description: 'Duration of NBA service API calls',
  unit: 'ms',
});

const apiCacheCounter = meter.createCounter('nba_service_cache_operations_total', {
  description: 'Total cache operations (hit/miss/set)',
});

const apiRetryCounter = meter.createCounter('nba_service_retry_attempts_total', {
  description: 'Total number of API retry attempts',
});

const apiTimeoutCounter = meter.createCounter('nba_service_timeouts_total', {
  description: 'Total number of API timeouts',
});

const dataQualityHistogram = meter.createHistogram('nba_service_data_quality_score', {
  description: 'Data quality scores for NBA service responses',
});

const rateLimitGauge = meter.createUpDownCounter('nba_service_rate_limit_remaining', {
  description: 'Remaining API rate limit calls',
});

interface ApiCallOptions {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  cacheKey?: string;
  cacheTTL?: number;
  requiresAuth?: boolean;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  cached: boolean;
  retryCount: number;
  duration: number;
  dataQualityScore?: number;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryCondition?: (error: any, attempt: number) => boolean;
}

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  quality?: number;
}

/**
 * Enhanced NBA Service with comprehensive observability
 */
export class NBAService {
  private static cache = new Map<string, CacheEntry>();
  private static readonly BASE_URL = 'https://stats.nba.com/stats';
  private static readonly DEFAULT_TIMEOUT = 15000; // 15 seconds
  private static readonly DEFAULT_RETRIES = 3;
  private static readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private static readonly RATE_LIMIT_MAX_CALLS = 100; // Max calls per minute

  // Rate limiting tracking
  private static rateLimitCalls = 0;
  private static rateLimitWindowStart = Date.now();

  // Default headers for NBA.com API
  private static readonly DEFAULT_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Host': 'stats.nba.com',
    'Origin': 'https://www.nba.com',
    'Referer': 'https://www.nba.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true',
  };

  /**
   * Execute an API call with comprehensive instrumentation
   */
  static async executeApiCall<T = any>(options: ApiCallOptions): Promise<ApiResponse<T>> {
    const {
      endpoint,
      method = 'GET',
      headers = {},
      body,
      timeout = this.DEFAULT_TIMEOUT,
      retries = this.DEFAULT_RETRIES,
      cacheKey,
      cacheTTL = 300000, // 5 minutes default
      requiresAuth = false,
    } = options;

    const operationId = `${method}_${endpoint}_${Date.now()}`;
    const span = tracer.startSpan('nba_service.api_call', {
      kind: SpanKind.CLIENT,
      attributes: {
        'nba.service.operation_id': operationId,
        'nba.service.endpoint': endpoint,
        'nba.service.method': method,
        'nba.service.timeout_ms': timeout,
        'nba.service.max_retries': retries,
        'nba.service.cache_enabled': !!cacheKey,
        'nba.service.requires_auth': requiresAuth,
      },
    });

    const startTime = performance.now();
    let retryCount = 0;
    let cached = false;

    try {
      // Check rate limiting
      if (!this.checkRateLimit()) {
        throw new Error('Rate limit exceeded');
      }

      // Check cache first
      if (cacheKey) {
        const cachedResult = this.getCachedData<T>(cacheKey);
        if (cachedResult) {
          cached = true;
          const duration = performance.now() - startTime;

          this.recordApiMetrics(endpoint, method, 200, duration, cached, retryCount, true);

          span.setAttributes({
            'nba.service.cache_hit': true,
            'nba.service.duration_ms': duration,
            'nba.service.data_size': JSON.stringify(cachedResult.data).length,
          });

          logger.emit({
            severityNumber: SeverityNumber.DEBUG,
            severityText: 'DEBUG',
            body: 'NBA service cache hit',
            attributes: {
              operation_id: operationId,
              endpoint: endpoint,
              cache_key: cacheKey,
              cache_age_ms: Date.now() - cachedResult.timestamp,
              cache_hits: cachedResult.hits,
            },
          });

          return {
            data: cachedResult.data,
            status: 200,
            statusText: 'OK (Cached)',
            headers: new Headers(),
            cached: true,
            retryCount: 0,
            duration,
            dataQualityScore: cachedResult.quality,
          };
        }

        span.setAttributes({
          'nba.service.cache_hit': false,
        });
      }

      // Execute API call with retry logic
      const retryConfig: RetryConfig = {
        maxRetries: retries,
        baseDelay: 1000,
        maxDelay: 10000,
        retryCondition: (error, attempt) => {
          // Retry on network errors, 5xx errors, and timeouts
          if (error.name === 'AbortError' || error.name === 'TimeoutError') return true;
          if (error.status >= 500) return true;
          if (error.status === 429) return true; // Rate limited
          return false;
        },
      };

      const response = await this.executeWithRetry(
        () => this.makeHttpRequest(endpoint, {
          method,
          headers: { ...this.DEFAULT_HEADERS, ...headers },
          body: body ? JSON.stringify(body) : undefined,
          timeout,
        }),
        retryConfig,
        operationId
      );

      retryCount = response.retryCount || 0;
      const duration = performance.now() - startTime;

      // Process response
      const responseData = await response.json();
      const dataSize = JSON.stringify(responseData).length;
      
      // Assess data quality
      const dataQualityScore = this.assessDataQuality(responseData);

      // Cache the response if successful
      if (cacheKey && response.ok) {
        this.setCachedData(cacheKey, responseData, cacheTTL, dataQualityScore);
      }

      // Record metrics and logs
      this.recordApiMetrics(endpoint, method, response.status, duration, cached, retryCount, response.ok);

      span.setAttributes({
        'nba.service.status_code': response.status,
        'nba.service.duration_ms': duration,
        'nba.service.retry_count': retryCount,
        'nba.service.data_size_bytes': dataSize,
        'nba.service.data_quality_score': dataQualityScore,
        'nba.service.success': response.ok,
      });

      if (!response.ok) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `API call failed: ${response.status} ${response.statusText}`,
        });

        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: 'ERROR',
          body: 'NBA service API call failed',
          attributes: {
            operation_id: operationId,
            endpoint: endpoint,
            method: method,
            status_code: response.status,
            status_text: response.statusText,
            duration_ms: duration,
            retry_count: retryCount,
          },
        });

        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'NBA service API call successful',
        attributes: {
          operation_id: operationId,
          endpoint: endpoint,
          method: method,
          status_code: response.status,
          duration_ms: duration,
          retry_count: retryCount,
          data_size_bytes: dataSize,
          data_quality_score: dataQualityScore,
          cached: cached,
        },
      });

      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        cached: false,
        retryCount,
        duration,
        dataQualityScore,
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });

      span.setAttributes({
        'nba.service.error': (error as Error).message,
        'nba.service.duration_ms': duration,
        'nba.service.retry_count': retryCount,
      });

      this.recordApiMetrics(endpoint, method, 0, duration, cached, retryCount, false);

      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'NBA service API call error',
        attributes: {
          operation_id: operationId,
          endpoint: endpoint,
          method: method,
          error: (error as Error).message,
          error_stack: (error as Error).stack,
          duration_ms: duration,
          retry_count: retryCount,
        },
      });

      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Execute HTTP request with timeout and proper error handling
   */
  private static async makeHttpRequest(
    endpoint: string,
    options: {
      method: string;
      headers: Record<string, string>;
      body?: string;
      timeout: number;
    }
  ): Promise<Response & { retryCount?: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      apiTimeoutCounter.add(1, {
        endpoint: endpoint,
        method: options.method,
      });
    }, options.timeout);

    try {
      const url = endpoint.startsWith('http') ? endpoint : `${this.BASE_URL}/${endpoint}`;
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Track rate limit headers if present
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (remaining) {
        rateLimitGauge.add(parseInt(remaining, 10), {
          endpoint: endpoint,
        });
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (controller.signal.aborted) {
        const timeoutError = new Error('Request timeout');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      
      throw error;
    }
  }

  /**
   * Execute request with exponential backoff retry logic
   */
  private static async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig,
    operationId: string
  ): Promise<T & { retryCount?: number }> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation();
        return { ...result, retryCount: attempt } as T & { retryCount?: number };
      } catch (error) {
        lastError = error;
        
        if (attempt === config.maxRetries) {
          break; // Max retries reached
        }

        if (!config.retryCondition || !config.retryCondition(error, attempt + 1)) {
          break; // Error is not retryable
        }

        // Calculate delay with exponential backoff
        const baseDelay = config.baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.3 * baseDelay; // Add 30% jitter
        const delay = Math.min(baseDelay + jitter, config.maxDelay);

        apiRetryCounter.add(1, {
          attempt: attempt + 1,
          operation_id: operationId,
          error_type: error.name || 'unknown',
        });

        logger.emit({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: `NBA service retry attempt ${attempt + 1}`,
          attributes: {
            operation_id: operationId,
            attempt: attempt + 1,
            max_retries: config.maxRetries,
            delay_ms: delay,
            error: error.message,
          },
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Check and enforce rate limiting
   */
  private static checkRateLimit(): boolean {
    const now = Date.now();
    
    // Reset window if needed
    if (now - this.rateLimitWindowStart >= this.RATE_LIMIT_WINDOW) {
      this.rateLimitCalls = 0;
      this.rateLimitWindowStart = now;
    }

    if (this.rateLimitCalls >= this.RATE_LIMIT_MAX_CALLS) {
      logger.emit({
        severityNumber: SeverityNumber.WARN,
        severityText: 'WARN',
        body: 'NBA service rate limit exceeded',
        attributes: {
          calls_made: this.rateLimitCalls,
          max_calls: this.RATE_LIMIT_MAX_CALLS,
          window_remaining_ms: this.RATE_LIMIT_WINDOW - (now - this.rateLimitWindowStart),
        },
      });
      return false;
    }

    this.rateLimitCalls++;
    return true;
  }

  /**
   * Get cached data with hit tracking
   */
  private static getCachedData<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      apiCacheCounter.add(1, {
        operation: 'miss',
        cache_key: key,
      });
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      apiCacheCounter.add(1, {
        operation: 'expired',
        cache_key: key,
      });
      return null;
    }

    // Update hit count
    entry.hits++;
    
    apiCacheCounter.add(1, {
      operation: 'hit',
      cache_key: key,
    });

    return entry;
  }

  /**
   * Set cached data with quality tracking
   */
  private static setCachedData<T>(key: string, data: T, ttl: number, quality?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      quality,
    };

    this.cache.set(key, entry);

    apiCacheCounter.add(1, {
      operation: 'set',
      cache_key: key,
    });

    logger.emit({
      severityNumber: SeverityNumber.DEBUG,
      severityText: 'DEBUG',
      body: 'NBA service data cached',
      attributes: {
        cache_key: key,
        ttl_ms: ttl,
        data_size_bytes: JSON.stringify(data).length,
        quality_score: quality,
      },
    });
  }

  /**
   * Assess data quality based on completeness and structure
   */
  private static assessDataQuality(data: any): number {
    try {
      let score = 100;
      
      // Check if data exists
      if (!data) return 0;
      
      // Check for result sets structure (NBA API specific)
      if (data.resultSets) {
        const resultSets = data.resultSets;
        
        // Penalize if no result sets
        if (!Array.isArray(resultSets) || resultSets.length === 0) {
          score -= 50;
        } else {
          // Check each result set
          resultSets.forEach((rs: any) => {
            if (!rs.name || !rs.headers || !rs.rowSet) {
              score -= 10;
            }
            
            // Check for empty data
            if (Array.isArray(rs.rowSet) && rs.rowSet.length === 0) {
              score -= 5;
            }
            
            // Check for header/data alignment
            if (rs.headers && rs.rowSet && rs.rowSet.length > 0) {
              const expectedColumns = rs.headers.length;
              const actualColumns = rs.rowSet[0]?.length || 0;
              
              if (expectedColumns !== actualColumns) {
                score -= 15;
              }
            }
          });
        }
      }
      
      // Check for error indicators
      if (data.error || data.errors) {
        score -= 30;
      }
      
      // Ensure score is within bounds
      score = Math.max(0, Math.min(100, score));
      
      dataQualityHistogram.record(score, {
        data_type: 'nba_api_response',
        quality_tier: score > 80 ? 'high' : score > 60 ? 'medium' : 'low',
      });
      
      return score;
    } catch (error) {
      logger.emit({
        severityNumber: SeverityNumber.WARN,
        severityText: 'WARN',
        body: 'Error assessing data quality',
        attributes: {
          error: (error as Error).message,
        },
      });
      return 50; // Default quality score
    }
  }

  /**
   * Record comprehensive API metrics
   */
  private static recordApiMetrics(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    cached: boolean,
    retryCount: number,
    success: boolean
  ): void {
    apiCallCounter.add(1, {
      endpoint: endpoint,
      method: method,
      status_code: statusCode.toString(),
      cached: cached ? 'true' : 'false',
      success: success ? 'true' : 'false',
    });

    apiCallDuration.record(duration, {
      endpoint: endpoint,
      method: method,
      success: success ? 'true' : 'false',
      performance_tier: duration < 1000 ? 'fast' : duration < 5000 ? 'normal' : 'slow',
    });
  }

  /**
   * Clear cache with comprehensive logging
   */
  static clearCache(): void {
    const span = tracer.startSpan('nba_service.clear_cache');

    try {
      const sizeBefore = this.cache.size;
      
      // Log cache statistics before clearing
      const cacheStats = this.getCacheStatistics();
      
      this.cache.clear();

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'NBA service cache cleared',
        attributes: {
          items_cleared: sizeBefore,
          ...cacheStats,
        },
      });

      span.setAttributes({
        'nba.service.cache_size_before': sizeBefore,
        'nba.service.cache_size_after': 0,
      });
    } finally {
      span.end();
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  static getCacheStatistics() {
    const totalHits = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.hits, 0);
    const totalEntries = this.cache.size;
    const averageHits = totalEntries > 0 ? totalHits / totalEntries : 0;
    
    const qualityScores = Array.from(this.cache.values())
      .filter(entry => entry.quality !== undefined)
      .map(entry => entry.quality!);
    
    const averageQuality = qualityScores.length > 0 
      ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length 
      : 0;

    return {
      total_entries: totalEntries,
      total_hits: totalHits,
      average_hits_per_entry: averageHits,
      average_quality_score: averageQuality,
    };
  }
}