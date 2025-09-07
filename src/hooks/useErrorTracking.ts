import { useCallback, useRef, useEffect } from 'react';
import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

// Error tracking metrics
const errorOccurrences = meter.createCounter('errors_total', {
  description: 'Total number of errors by type and source',
});

const errorRecoveries = meter.createCounter('error_recoveries_total', {
  description: 'Total number of successful error recoveries',
});

const errorSeverityCount = meter.createCounter('error_severity_total', {
  description: 'Total number of errors by severity level',
});

const errorContextSize = meter.createHistogram('error_context_size_bytes', {
  description: 'Size of error context data in bytes',
  unit: 'By',
});

const userErrorActions = meter.createCounter('user_error_actions_total', {
  description: 'Total number of user actions that resulted in errors',
});

interface ErrorContext {
  /** Component or module where the error occurred */
  source: string;
  /** User ID if available */
  userId?: string;
  /** Session ID for tracking user sessions */
  sessionId?: string;
  /** Current URL/route */
  url?: string;
  /** User agent information */
  userAgent?: string;
  /** Timestamp when error occurred */
  timestamp: string;
  /** Additional context data */
  metadata?: Record<string, any>;
  /** User action that led to the error */
  userAction?: string;
  /** Stack trace if available */
  stackTrace?: string;
  /** Component props at time of error */
  componentProps?: Record<string, any>;
  /** Application state at time of error */
  appState?: Record<string, any>;
}

interface ErrorSeverity {
  LOW: 'low';
  MEDIUM: 'medium';
  HIGH: 'high';
  CRITICAL: 'critical';
}

const ERROR_SEVERITY: ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

type ErrorSeverityLevel = ErrorSeverity[keyof ErrorSeverity];

interface ErrorTrackingOptions {
  /** Source identifier (component name, service, etc.) */
  source: string;
  /** Whether to automatically track unhandled errors */
  trackUnhandledErrors?: boolean;
  /** Whether to track promise rejections */
  trackUnhandledRejections?: boolean;
  /** Additional context to include with all errors */
  defaultContext?: Record<string, any>;
  /** Function to determine error severity */
  getSeverity?: (error: Error, context: ErrorContext) => ErrorSeverityLevel;
  /** Function to sanitize sensitive data from error context */
  sanitizeContext?: (context: ErrorContext) => ErrorContext;
}

interface TrackedError extends Error {
  errorId: string;
  severity: ErrorSeverityLevel;
  context: ErrorContext;
  spanId?: string;
  traceId?: string;
  recoverable: boolean;
}

interface ErrorTrackingData {
  /** Track an error with full context */
  trackError: (
    error: Error,
    severity?: ErrorSeverityLevel,
    additionalContext?: Record<string, any>
  ) => TrackedError;
  
  /** Track an error with custom message */
  trackErrorMessage: (
    message: string,
    severity?: ErrorSeverityLevel,
    additionalContext?: Record<string, any>
  ) => TrackedError;
  
  /** Track a warning (non-error condition that should be monitored) */
  trackWarning: (
    message: string,
    additionalContext?: Record<string, any>
  ) => void;
  
  /** Track an error recovery attempt */
  trackRecovery: (
    errorId: string,
    recoveryStrategy: string,
    success: boolean,
    additionalContext?: Record<string, any>
  ) => void;
  
  /** Track user actions that might lead to errors */
  trackUserAction: (
    action: string,
    additionalContext?: Record<string, any>
  ) => string; // Returns action ID for correlation
  
  /** Create an error boundary function with tracking */
  createErrorBoundary: <T>(
    operation: () => T | Promise<T>,
    operationName: string
  ) => Promise<T>;
  
  /** Get current session/context info */
  getErrorContext: () => ErrorContext;
}

/**
 * Comprehensive error tracking hook with OpenTelemetry integration.
 * Provides structured error logging, metrics collection, and recovery tracking.
 * 
 * @example
 * ```tsx
 * function DataComponent({ playerId }: { playerId: string }) {
 *   const errorTracker = useErrorTracking({
 *     source: 'DataComponent',
 *     trackUnhandledErrors: true,
 *     defaultContext: { player_id: playerId },
 *     getSeverity: (error) => {
 *       if (error.message.includes('network')) return 'medium';
 *       if (error.message.includes('validation')) return 'low';
 *       return 'high';
 *     }
 *   });
 * 
 *   const fetchData = async () => {
 *     const actionId = errorTracker.trackUserAction('fetch_player_data', { player_id: playerId });
 *     
 *     try {
 *       return await errorTracker.createErrorBoundary(
 *         () => fetch(`/api/players/${playerId}`).then(r => r.json()),
 *         'fetch_player_data'
 *       );
 *     } catch (error) {
 *       const trackedError = errorTracker.trackError(error as Error, 'medium');
 *       
 *       // Attempt recovery
 *       errorTracker.trackRecovery(trackedError.errorId, 'retry_with_cache', false);
 *       throw trackedError;
 *     }
 *   };
 * 
 *   return <div>...</div>;
 * }
 * ```
 */
export function useErrorTracking(options: ErrorTrackingOptions): ErrorTrackingData {
  const {
    source,
    trackUnhandledErrors = false,
    trackUnhandledRejections = false,
    defaultContext = {},
    getSeverity,
    sanitizeContext,
  } = options;

  const sessionId = useRef<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const userActions = useRef<Map<string, { action: string; timestamp: number; context: any }>>(new Map());

  // Set up global error handlers
  useEffect(() => {
    const handleUnhandledError = (event: ErrorEvent) => {
      if (trackUnhandledErrors) {
        trackError(
          new Error(event.message),
          'critical',
          {
            error_type: 'unhandled_error',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: event.error?.stack,
          }
        );
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (trackUnhandledRejections) {
        const error = event.reason instanceof Error 
          ? event.reason 
          : new Error(String(event.reason));
        
        trackError(
          error,
          'high',
          {
            error_type: 'unhandled_promise_rejection',
            reason: String(event.reason),
          }
        );
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('error', handleUnhandledError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);

      return () => {
        window.removeEventListener('error', handleUnhandledError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }
  }, [trackUnhandledErrors, trackUnhandledRejections, source]);

  const getErrorContext = useCallback((): ErrorContext => {
    const context: ErrorContext = {
      source,
      sessionId: sessionId.current,
      timestamp: new Date().toISOString(),
      ...defaultContext,
    };

    if (typeof window !== 'undefined') {
      context.url = window.location.href;
      context.userAgent = navigator.userAgent;
    }

    return sanitizeContext ? sanitizeContext(context) : context;
  }, [source, defaultContext, sanitizeContext]);

  const determineErrorSeverity = useCallback((
    error: Error,
    context: ErrorContext
  ): ErrorSeverityLevel => {
    if (getSeverity) {
      return getSeverity(error, context);
    }

    // Default severity logic
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    if (errorName.includes('typeerror') || errorName.includes('referenceerror')) {
      return ERROR_SEVERITY.HIGH;
    }

    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return ERROR_SEVERITY.MEDIUM;
    }

    if (errorMessage.includes('validation') || errorMessage.includes('input')) {
      return ERROR_SEVERITY.LOW;
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('abort')) {
      return ERROR_SEVERITY.MEDIUM;
    }

    return ERROR_SEVERITY.HIGH; // Default to high for unknown errors
  }, [getSeverity]);

  const trackError = useCallback((
    error: Error,
    severity?: ErrorSeverityLevel,
    additionalContext: Record<string, any> = {}
  ): TrackedError => {
    const context = {
      ...getErrorContext(),
      ...additionalContext,
      stackTrace: error.stack,
    };

    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const finalSeverity = severity || determineErrorSeverity(error, context);
    
    const span = tracer.startSpan(`error.${source}.${error.name}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'error.id': errorId,
        'error.type': error.name,
        'error.message': error.message,
        'error.severity': finalSeverity,
        'error.source': source,
        'error.recoverable': true, // Assume recoverable unless specified
        'error.session_id': context.sessionId,
        'error.url': context.url || '',
        ...Object.fromEntries(
          Object.entries(additionalContext).map(([k, v]) => [`error.context.${k}`, String(v)])
        ),
      },
    });

    try {
      // Record metrics
      errorOccurrences.add(1, {
        error_type: error.name,
        error_source: source,
        error_severity: finalSeverity,
      });

      errorSeverityCount.add(1, {
        severity: finalSeverity,
        source: source,
      });

      // Calculate context size
      const contextSize = new TextEncoder().encode(JSON.stringify(context)).length;
      errorContextSize.record(contextSize, {
        error_type: error.name,
        source: source,
      });

      // Record exception in span
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `${error.name}: ${error.message}`,
      });

      // Emit structured log
      const logSeverity = {
        [ERROR_SEVERITY.LOW]: SeverityNumber.INFO,
        [ERROR_SEVERITY.MEDIUM]: SeverityNumber.WARN,
        [ERROR_SEVERITY.HIGH]: SeverityNumber.ERROR,
        [ERROR_SEVERITY.CRITICAL]: SeverityNumber.FATAL,
      }[finalSeverity];

      logger.emit({
        severityNumber: logSeverity,
        severityText: finalSeverity.toUpperCase(),
        body: `Error tracked in ${source}: ${error.message}`,
        attributes: {
          error_id: errorId,
          error_type: error.name,
          error_message: error.message,
          error_severity: finalSeverity,
          error_source: source,
          error_stack: error.stack || 'No stack trace',
          error_context: JSON.stringify(context),
          trace_id: span.spanContext().traceId,
          span_id: span.spanContext().spanId,
          ...additionalContext,
        },
      });

      // Create tracked error object
      const trackedError = Object.assign(error, {
        errorId,
        severity: finalSeverity,
        context,
        spanId: span.spanContext().spanId,
        traceId: span.spanContext().traceId,
        recoverable: true,
      }) as TrackedError;

      return trackedError;

    } finally {
      span.end();
    }
  }, [source, getErrorContext, determineErrorSeverity]);

  const trackErrorMessage = useCallback((
    message: string,
    severity: ErrorSeverityLevel = ERROR_SEVERITY.HIGH,
    additionalContext: Record<string, any> = {}
  ): TrackedError => {
    const error = new Error(message);
    error.name = 'CustomError';
    return trackError(error, severity, additionalContext);
  }, [trackError]);

  const trackWarning = useCallback((
    message: string,
    additionalContext: Record<string, any> = {}
  ) => {
    const context = {
      ...getErrorContext(),
      ...additionalContext,
    };

    const span = tracer.startSpan(`warning.${source}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'warning.message': message,
        'warning.source': source,
        'warning.session_id': context.sessionId,
        ...Object.fromEntries(
          Object.entries(additionalContext).map(([k, v]) => [`warning.context.${k}`, String(v)])
        ),
      },
    });

    try {
      logger.emit({
        severityNumber: SeverityNumber.WARN,
        severityText: 'WARN',
        body: `Warning in ${source}: ${message}`,
        attributes: {
          warning_source: source,
          warning_message: message,
          warning_context: JSON.stringify(context),
          trace_id: span.spanContext().traceId,
          span_id: span.spanContext().spanId,
          ...additionalContext,
        },
      });

      span.setStatus({ code: SpanStatusCode.OK });

    } finally {
      span.end();
    }
  }, [source, getErrorContext]);

  const trackRecovery = useCallback((
    errorId: string,
    recoveryStrategy: string,
    success: boolean,
    additionalContext: Record<string, any> = {}
  ) => {
    const span = tracer.startSpan(`error_recovery.${source}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'recovery.error_id': errorId,
        'recovery.strategy': recoveryStrategy,
        'recovery.success': success,
        'recovery.source': source,
        ...Object.fromEntries(
          Object.entries(additionalContext).map(([k, v]) => [`recovery.context.${k}`, String(v)])
        ),
      },
    });

    try {
      errorRecoveries.add(1, {
        error_source: source,
        recovery_strategy: recoveryStrategy,
        recovery_success: success.toString(),
      });

      logger.emit({
        severityNumber: success ? SeverityNumber.INFO : SeverityNumber.WARN,
        severityText: success ? 'INFO' : 'WARN',
        body: `Error recovery ${success ? 'successful' : 'failed'} in ${source}`,
        attributes: {
          error_id: errorId,
          recovery_strategy: recoveryStrategy,
          recovery_success: success,
          recovery_source: source,
          trace_id: span.spanContext().traceId,
          span_id: span.spanContext().spanId,
          ...additionalContext,
        },
      });

      span.setStatus({
        code: success ? SpanStatusCode.OK : SpanStatusCode.ERROR,
        message: `Recovery ${success ? 'succeeded' : 'failed'}: ${recoveryStrategy}`,
      });

    } finally {
      span.end();
    }
  }, [source]);

  const trackUserAction = useCallback((
    action: string,
    additionalContext: Record<string, any> = {}
  ): string => {
    const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const actionData = {
      action,
      timestamp: Date.now(),
      context: {
        ...getErrorContext(),
        ...additionalContext,
      },
    };

    userActions.current.set(actionId, actionData);

    // Clean up old actions (keep last 100)
    if (userActions.current.size > 100) {
      const actions = Array.from(userActions.current.entries());
      actions.sort((a, b) => a[1].timestamp - b[1].timestamp);
      actions.slice(0, -100).forEach(([id]) => userActions.current.delete(id));
    }

    userErrorActions.add(1, {
      action,
      source: source,
    });

    logger.emit({
      severityNumber: SeverityNumber.DEBUG,
      severityText: 'DEBUG',
      body: `User action tracked: ${action}`,
      attributes: {
        action_id: actionId,
        user_action: action,
        action_source: source,
        ...additionalContext,
      },
    });

    return actionId;
  }, [source, getErrorContext]);

  const createErrorBoundary = useCallback(async <T>(
    operation: () => T | Promise<T>,
    operationName: string
  ): Promise<T> => {
    const span = tracer.startSpan(`error_boundary.${source}.${operationName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'operation.name': operationName,
        'operation.source': source,
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

      span.setStatus({ code: SpanStatusCode.OK });
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      span.setAttributes({
        'operation.duration_ms': duration,
        'operation.success': false,
      });

      const trackedError = trackError(
        error as Error,
        ERROR_SEVERITY.HIGH,
        {
          operation_name: operationName,
          operation_duration_ms: duration,
        }
      );

      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Operation failed: ${operationName}`,
      });

      throw trackedError;

    } finally {
      span.end();
    }
  }, [source, trackError]);

  return {
    trackError,
    trackErrorMessage,
    trackWarning,
    trackRecovery,
    trackUserAction,
    createErrorBoundary,
    getErrorContext,
  };
}

/**
 * Simplified hook for basic error logging.
 * Provides a lightweight alternative for simple error tracking needs.
 * 
 * @example
 * ```tsx
 * function SimpleComponent() {
 *   const logError = useSimpleErrorTracking('SimpleComponent');
 *   
 *   const handleClick = async () => {
 *     try {
 *       await riskyOperation();
 *     } catch (error) {
 *       logError(error as Error);
 *     }
 *   };
 * 
 *   return <button onClick={handleClick}>Click me</button>;
 * }
 * ```
 */
export function useSimpleErrorTracking(source: string) {
  const errorTracker = useErrorTracking({ source });
  return errorTracker.trackError;
}

export { ERROR_SEVERITY };
export type { ErrorTrackingOptions, TrackedError, ErrorSeverityLevel };
export default useErrorTracking;