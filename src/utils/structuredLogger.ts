import { SeverityNumber } from '@opentelemetry/api-logs';
import { trace } from '@opentelemetry/api';
import { logger, tracer } from '../otel-client';

/**
 * Structured Logger Utility for NBA Analytics
 * 
 * Provides consistent, structured logging across the application with
 * automatic trace correlation and contextual information.
 */

export interface LogContext {
  component?: string;
  feature?: string;
  entityType?: 'player' | 'team' | 'league';
  entityId?: string;
  entityName?: string;
  season?: string;
  operation?: string;
  duration?: number;
  dataSize?: number;
  cacheHit?: boolean;
  error?: Error;
  userAction?: string;
  [key: string]: any;
}

export class StructuredLogger {
  private static getTraceContext() {
    const span = trace.getActiveSpan();
    if (span) {
      const spanContext = span.spanContext();
      return {
        trace_id: spanContext.traceId,
        span_id: spanContext.spanId,
        trace_flags: spanContext.traceFlags,
      };
    }
    return {};
  }

  private static getBaseAttributes(context?: LogContext) {
    return {
      service: 'hoops-analytics-viz',
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      user_agent: typeof window !== 'undefined' ? navigator.userAgent : '',
      environment: import.meta.env.MODE,
      ...this.getTraceContext(),
      ...(context || {}),
    };
  }

  static debug(message: string, context?: LogContext) {
    const attributes = this.getBaseAttributes(context);
    // Convert Error objects to strings for OpenTelemetry compatibility
    const cleanAttributes = Object.fromEntries(
      Object.entries(attributes).map(([key, value]) => [
        key,
        value instanceof Error ? value.message : value
      ])
    );

    logger.emit({
      severityNumber: SeverityNumber.DEBUG,
      severityText: 'DEBUG',
      body: message,
      attributes: cleanAttributes,
    });

    // Also log to console in development
    if (import.meta.env.MODE === 'development') {
      console.debug(`🐛 [DEBUG] ${message}`, context);
    }
  }

  static info(message: string, context?: LogContext) {
    const attributes = this.getBaseAttributes(context);
    const cleanAttributes = Object.fromEntries(
      Object.entries(attributes).map(([key, value]) => [
        key,
        value instanceof Error ? value.message : value
      ])
    );

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: message,
      attributes: cleanAttributes,
    });

    if (import.meta.env.MODE === 'development') {
      console.info(`ℹ️ [INFO] ${message}`, context);
    }
  }

  static warn(message: string, context?: LogContext) {
    const attributes = this.getBaseAttributes(context);
    const cleanAttributes = Object.fromEntries(
      Object.entries(attributes).map(([key, value]) => [
        key,
        value instanceof Error ? value.message : value
      ])
    );

    logger.emit({
      severityNumber: SeverityNumber.WARN,
      severityText: 'WARN',
      body: message,
      attributes: cleanAttributes,
    });

    console.warn(`⚠️ [WARN] ${message}`, context);
  }

  static error(message: string, context?: LogContext) {
    const errorAttributes = {
      ...this.getBaseAttributes(context),
      error_message: context?.error?.message,
      error_stack: context?.error?.stack,
      error_name: context?.error?.name,
    };
    
    const cleanAttributes = Object.fromEntries(
      Object.entries(errorAttributes).map(([key, value]) => [
        key,
        value instanceof Error ? value.message : value
      ])
    );

    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: message,
      attributes: cleanAttributes,
    });

    console.error(`❌ [ERROR] ${message}`, context);
  }

  static fatal(message: string, context?: LogContext) {
    const fatalAttributes = {
      ...this.getBaseAttributes(context),
      error_message: context?.error?.message,
      error_stack: context?.error?.stack,
      error_name: context?.error?.name,
    };
    
    const cleanAttributes = Object.fromEntries(
      Object.entries(fatalAttributes).map(([key, value]) => [
        key,
        value instanceof Error ? value.message : value
      ])
    );

    logger.emit({
      severityNumber: SeverityNumber.FATAL,
      severityText: 'FATAL',
      body: message,
      attributes: cleanAttributes,
    });

    console.error(`💀 [FATAL] ${message}`, context);
  }

  // NBA-specific logging methods
  static nbaDataLoaded(
    dataType: 'shot_data' | 'player_info' | 'statistics' | 'league_data',
    context: LogContext
  ) {
    this.info(`NBA ${dataType} loaded successfully`, {
      ...context,
      data_type: dataType,
      category: 'data_loading',
    });
  }

  static nbaUserAction(action: string, context: LogContext) {
    this.info(`NBA user action: ${action}`, {
      ...context,
      user_action: action,
      category: 'user_interaction',
    });
  }

  static nbaPerformance(
    operation: string,
    duration: number,
    context: LogContext = {}
  ) {
    const level = duration > 5000 ? 'warn' : duration > 2000 ? 'info' : 'debug';
    const message = `NBA operation performance: ${operation} (${duration}ms)`;
    
    const perfContext = {
      ...context,
      operation,
      duration,
      performance_tier: duration > 5000 ? 'slow' : duration > 2000 ? 'normal' : 'fast',
      category: 'performance',
    };

    if (level === 'warn') {
      this.warn(message, perfContext);
    } else if (level === 'info') {
      this.info(message, perfContext);
    } else {
      this.debug(message, perfContext);
    }
  }

  static nbaCache(
    operation: 'hit' | 'miss' | 'set' | 'clear',
    key: string,
    context: LogContext = {}
  ) {
    this.debug(`NBA cache ${operation}: ${key}`, {
      ...context,
      cache_operation: operation,
      cache_key: key,
      category: 'caching',
    });
  }

  static nbaApiCall(
    endpoint: string,
    duration: number,
    success: boolean,
    context: LogContext = {}
  ) {
    const message = `NBA API call: ${endpoint} (${duration}ms) - ${success ? 'SUCCESS' : 'FAILED'}`;
    
    const apiContext = {
      ...context,
      api_endpoint: endpoint,
      duration,
      success,
      category: 'api_call',
    };

    if (success) {
      if (duration > 10000) {
        this.warn(message, apiContext);
      } else {
        this.info(message, apiContext);
      }
    } else {
      this.error(message, apiContext);
    }
  }

  static nbaError(
    errorType: 'data_loading' | 'api_call' | 'rendering' | 'user_action' | 'cache' | 'unknown',
    message: string,
    error: Error,
    context: LogContext = {}
  ) {
    this.error(`NBA ${errorType} error: ${message}`, {
      ...context,
      error,
      error_type: errorType,
      category: 'error',
    });
  }

  // Utility method to create a child logger with preset context
  static withContext(baseContext: LogContext) {
    return {
      debug: (message: string, additionalContext?: LogContext) =>
        StructuredLogger.debug(message, { ...baseContext, ...additionalContext }),
      info: (message: string, additionalContext?: LogContext) =>
        StructuredLogger.info(message, { ...baseContext, ...additionalContext }),
      warn: (message: string, additionalContext?: LogContext) =>
        StructuredLogger.warn(message, { ...baseContext, ...additionalContext }),
      error: (message: string, additionalContext?: LogContext) =>
        StructuredLogger.error(message, { ...baseContext, ...additionalContext }),
      fatal: (message: string, additionalContext?: LogContext) =>
        StructuredLogger.fatal(message, { ...baseContext, ...additionalContext }),
    };
  }

  // Method to log with automatic span creation
  static withSpan<T>(
    spanName: string,
    operation: () => T,
    context?: LogContext
  ): T {
    const cleanContext = context ? Object.fromEntries(
      Object.entries(context).map(([key, value]) => [
        key,
        value instanceof Error ? value.message : value
      ])
    ) : {};
    
    const span = tracer.startSpan(spanName, {
      attributes: {
        ...cleanContext,
        operation_type: 'logged_operation',
      },
    });

    try {
      this.debug(`Starting operation: ${spanName}`, context);
      const result = operation();
      this.debug(`Completed operation: ${spanName}`, context);
      return result;
    } catch (error) {
      this.error(`Error in operation: ${spanName}`, {
        ...context,
        error: error as Error,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  // Async version of withSpan
  static async withSpanAsync<T>(
    spanName: string,
    operation: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const cleanContext = context ? Object.fromEntries(
      Object.entries(context).map(([key, value]) => [
        key,
        value instanceof Error ? value.message : value
      ])
    ) : {};
    
    const span = tracer.startSpan(spanName, {
      attributes: {
        ...cleanContext,
        operation_type: 'logged_async_operation',
      },
    });

    try {
      this.debug(`Starting async operation: ${spanName}`, context);
      const result = await operation();
      this.debug(`Completed async operation: ${spanName}`, context);
      return result;
    } catch (error) {
      this.error(`Error in async operation: ${spanName}`, {
        ...context,
        error: error as Error,
      });
      throw error;
    } finally {
      span.end();
    }
  }
}