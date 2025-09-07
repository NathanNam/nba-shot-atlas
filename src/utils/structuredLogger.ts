import { SeverityNumber } from '@opentelemetry/api-logs';
import { logger, tracer } from '../otel-client';
import { trace, context } from '@opentelemetry/api';

interface LogContext {
  component?: string;
  operation?: string;
  entityId?: string;
  entityName?: string;
  season?: string;
  viewMode?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: any;
}

interface LogMessage {
  message: string;
  context?: LogContext;
  error?: Error;
  metadata?: Record<string, any>;
}

class StructuredLogger {
  private static instance: StructuredLogger;
  private sessionId: string;
  private requestCounter: number = 0;

  private constructor() {
    this.sessionId = this.generateSessionId();
  }

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    this.requestCounter++;
    return `req_${this.sessionId}_${this.requestCounter}`;
  }

  private getContextualInfo(): Record<string, any> {
    const activeSpan = trace.getActiveSpan();
    const spanContext = activeSpan ? trace.setSpanContext(context.active(), activeSpan.spanContext()) : undefined;
    
    return {
      session_id: this.sessionId,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      trace_id: activeSpan ? activeSpan.spanContext().traceId : undefined,
      span_id: activeSpan ? activeSpan.spanContext().spanId : undefined,
      viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined,
      memory_info: this.getMemoryInfo(),
      connection_info: this.getConnectionInfo(),
    };
  }

  private getMemoryInfo(): Record<string, any> | undefined {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        used_heap_mb: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
        total_heap_mb: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
        heap_limit_mb: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
      };
    }
    return undefined;
  }

  private getConnectionInfo(): Record<string, any> | undefined {
    if (typeof navigator !== 'undefined' && (navigator as any).connection) {
      const connection = (navigator as any).connection;
      return {
        effective_type: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        save_data: connection.saveData,
      };
    }
    return undefined;
  }

  private emit(severityNumber: SeverityNumber, severityText: string, logMessage: LogMessage) {
    const requestId = this.generateRequestId();
    const contextualInfo = this.getContextualInfo();
    
    if (logger?.emit) {
      logger.emit({
        severityNumber,
        severityText,
        body: logMessage.message,
        attributes: {
          request_id: requestId,
          ...contextualInfo,
          ...logMessage.context,
          ...logMessage.metadata,
          error_name: logMessage.error?.name,
          error_message: logMessage.error?.message,
          error_stack: logMessage.error?.stack,
        },
      });
    }

    // Also log to console in development for better debugging
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = severityNumber >= SeverityNumber.ERROR ? 'error' :
                           severityNumber >= SeverityNumber.WARN ? 'warn' :
                           'log';
      
      console[consoleMethod](`[${severityText}] ${logMessage.message}`, {
        context: logMessage.context,
        metadata: logMessage.metadata,
        error: logMessage.error,
        requestId,
      });
    }
  }

  info(message: string, context?: LogContext, metadata?: Record<string, any>) {
    this.emit(SeverityNumber.INFO, 'INFO', { message, context, metadata });
  }

  warn(message: string, context?: LogContext, metadata?: Record<string, any>) {
    this.emit(SeverityNumber.WARN, 'WARN', { message, context, metadata });
  }

  error(message: string, error?: Error, context?: LogContext, metadata?: Record<string, any>) {
    this.emit(SeverityNumber.ERROR, 'ERROR', { message, error, context, metadata });
  }

  debug(message: string, context?: LogContext, metadata?: Record<string, any>) {
    this.emit(SeverityNumber.DEBUG, 'DEBUG', { message, context, metadata });
  }

  // NBA-specific logging methods
  logPlayerAction(action: string, playerName: string, season: string, metadata?: Record<string, any>) {
    this.info(`Player action: ${action}`, {
      component: 'PlayerInteraction',
      operation: action,
      entityName: playerName,
      season,
    }, metadata);
  }

  logDataLoading(operation: string, entityType: string, entityId: string, season: string, duration?: number, error?: Error) {
    if (error) {
      this.error(`Data loading failed: ${operation}`, error, {
        component: 'DataService',
        operation,
        entityId,
        season,
        viewMode: entityType,
      }, { duration_ms: duration });
    } else {
      this.info(`Data loading completed: ${operation}`, {
        component: 'DataService',
        operation,
        entityId,
        season,
        viewMode: entityType,
      }, { duration_ms: duration });
    }
  }

  logComponentLifecycle(componentName: string, lifecycle: string, duration?: number, metadata?: Record<string, any>) {
    this.debug(`Component ${lifecycle}: ${componentName}`, {
      component: componentName,
      operation: lifecycle,
    }, { duration_ms: duration, ...metadata });
  }

  logUserInteraction(interaction: string, target: string, context?: LogContext, metadata?: Record<string, any>) {
    this.info(`User interaction: ${interaction}`, {
      component: 'UserInteraction',
      operation: interaction,
      ...context,
    }, { target, ...metadata });
  }

  logPerformanceMetric(metricName: string, value: number, unit: string, context?: LogContext, metadata?: Record<string, any>) {
    this.info(`Performance metric: ${metricName}`, {
      component: 'PerformanceMonitor',
      operation: 'metric_recorded',
      ...context,
    }, { 
      metric_name: metricName, 
      metric_value: value, 
      metric_unit: unit, 
      ...metadata 
    });
  }
}

// Export singleton instance
export const structuredLogger = StructuredLogger.getInstance();

// Export convenience methods
export const logInfo = (message: string, context?: LogContext, metadata?: Record<string, any>) => 
  structuredLogger.info(message, context, metadata);

export const logWarn = (message: string, context?: LogContext, metadata?: Record<string, any>) => 
  structuredLogger.warn(message, context, metadata);

export const logError = (message: string, error?: Error, context?: LogContext, metadata?: Record<string, any>) => 
  structuredLogger.error(message, error, context, metadata);

export const logDebug = (message: string, context?: LogContext, metadata?: Record<string, any>) => 
  structuredLogger.debug(message, context, metadata);