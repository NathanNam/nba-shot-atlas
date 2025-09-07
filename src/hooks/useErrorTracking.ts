import { useCallback, useRef, useEffect } from 'react';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

/**
 * Error tracking metrics
 */
const errorCounter = meter.createCounter('errors_total', {
  description: 'Total number of errors tracked',
});

const errorRecoveryCounter = meter.createCounter('error_recoveries_total', {
  description: 'Total number of error recoveries attempted',
});

const errorDuration = meter.createHistogram('error_handling_duration_ms', {
  description: 'Time taken to handle and report errors',
  unit: 'ms',
});

interface ErrorContext {
  /**
   * Component or module where the error occurred
   */
  component?: string;
  /**
   * Function or method where the error occurred
   */
  function?: string;
  /**
   * User action that triggered the error
   */
  userAction?: string;
  /**
   * Current URL when error occurred
   */
  url?: string;
  /**
   * User agent information
   */
  userAgent?: string;
  /**
   * Additional custom context
   */
  customContext?: Record<string, any>;
  /**
   * Session information
   */
  sessionContext?: {
    sessionId?: string;
    userId?: string;
    sessionDuration?: number;
  };
}

interface ErrorTrackingOptions {
  /**
   * Automatically capture common error context
   */
  autoCapture?: boolean;
  /**
   * Enable automatic error recovery attempts
   */
  enableRecovery?: boolean;
  /**
   * Maximum number of recovery attempts
   */
  maxRecoveryAttempts?: number;
  /**
   * Custom error handler function
   */
  onError?: (error: Error, context: ErrorContext) => void;
  /**
   * Custom recovery function
   */
  onRecovery?: (error: Error, context: ErrorContext, attempt: number) => Promise<boolean>;
}

interface TrackedError {
  error: Error;
  context: ErrorContext;
  timestamp: number;
  spanId: string;
  recoveryAttempts: number;
}

export interface UseErrorTrackingReturn {
  /**
   * Track an error with full context
   */
  trackError: (error: Error, context?: Partial<ErrorContext>) => string;
  /**
   * Track an async error with proper span context
   */
  trackAsyncError: (error: Error, context?: Partial<ErrorContext>) => Promise<string>;
  /**
   * Attempt to recover from an error
   */
  attemptRecovery: (errorId: string, recoveryAction?: () => Promise<void>) => Promise<boolean>;
  /**
   * Create an error boundary for a specific operation
   */
  createErrorBoundary: <T>(
    operation: () => T | Promise<T>,
    context?: Partial<ErrorContext>
  ) => Promise<T>;
  /**
   * Get error statistics
   */
  getErrorStats: () => {
    totalErrors: number;
    totalRecoveries: number;
    successfulRecoveries: number;
    recentErrors: TrackedError[];
  };
  /**
   * Clear error history
   */
  clearErrorHistory: () => void;
}

/**
 * Advanced error tracking hook with OpenTelemetry integration
 * 
 * Provides comprehensive error monitoring including:
 * - Structured error context capture
 * - Automatic span creation for errors
 * - Integration with existing ErrorBoundary
 * - Error recovery mechanisms
 * - Session and user context correlation
 * - Async error handling
 * - Error statistics and trends
 * 
 * @param options Configuration options for error tracking
 * @returns Error tracking utilities and methods
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { trackError, createErrorBoundary, attemptRecovery } = useErrorTracking({
 *     autoCapture: true,
 *     enableRecovery: true,
 *     maxRecoveryAttempts: 3,
 *     onError: (error, context) => {
 *       // Custom error handling logic
 *       console.error('Custom error handler:', error, context);
 *     },
 *     onRecovery: async (error, context, attempt) => {
 *       // Custom recovery logic
 *       if (attempt <= 2) {
 *         // Try to recover
 *         return true;
 *       }
 *       return false;
 *     }
 *   });
 * 
 *   const handleApiCall = async () => {
 *     try {
 *       const result = await createErrorBoundary(
 *         () => fetch('/api/data'),
 *         { component: 'MyComponent', function: 'handleApiCall' }
 *       );
 *       return result;
 *     } catch (error) {
 *       const errorId = trackError(error as Error, {
 *         userAction: 'api_call',
 *         customContext: { endpoint: '/api/data' }
 *       });
 *       
 *       // Attempt recovery
 *       const recovered = await attemptRecovery(errorId);
 *       if (!recovered) {
 *         throw error;
 *       }
 *     }
 *   };
 * 
 *   return <div>...</div>;
 * }
 * ```
 */
export function useErrorTracking(options: ErrorTrackingOptions = {}): UseErrorTrackingReturn {
  const {
    autoCapture = true,
    enableRecovery = false,
    maxRecoveryAttempts = 3,
    onError,
    onRecovery,
  } = options;

  // Error tracking state
  const errorHistory = useRef<Map<string, TrackedError>>(new Map());
  const recoveryAttempts = useRef<Map<string, number>>(new Map());
  const errorStats = useRef({
    totalErrors: 0,
    totalRecoveries: 0,
    successfulRecoveries: 0,
  });

  /**
   * Generate unique error ID
   */
  const generateErrorId = useCallback(() => {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Capture automatic error context
   */
  const captureContext = useCallback((): ErrorContext => {
    if (!autoCapture) return {};

    try {
      const context: ErrorContext = {};

      if (typeof window !== 'undefined') {
        context.url = window.location.href;
        context.userAgent = navigator.userAgent;
      }

      // Capture session context if available
      const sessionId = sessionStorage.getItem('sessionId');
      if (sessionId) {
        context.sessionContext = {
          sessionId,
          sessionDuration: Date.now() - parseInt(sessionStorage.getItem('sessionStartTime') || '0'),
        };
      }

      return context;
    } catch (error) {
      // Fail silently if context capture fails
      return {};
    }
  }, [autoCapture]);

  /**
   * Track an error with full context
   */
  const trackError = useCallback((error: Error, context: Partial<ErrorContext> = {}): string => {
    const startTime = performance.now();
    const errorId = generateErrorId();
    
    // Create error span
    const span = tracer.startSpan('error_tracking.track_error', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'error.type': error.name,
        'error.message': error.message,
        'error.id': errorId,
        'error.stack': error.stack || 'No stack trace available',
      },
    });

    try {
      // Merge contexts
      const fullContext: ErrorContext = {
        ...captureContext(),
        ...context,
      };

      // Store tracked error
      const trackedError: TrackedError = {
        error,
        context: fullContext,
        timestamp: Date.now(),
        spanId: span.spanContext().spanId,
        recoveryAttempts: 0,
      };

      errorHistory.current.set(errorId, trackedError);
      errorStats.current.totalErrors++;

      // Record error metrics
      errorCounter.add(1, {
        error_type: error.name,
        component: context.component || 'unknown',
        function: context.function || 'unknown',
        user_action: context.userAction || 'unknown',
      });

      // Set span attributes
      span.setAttributes({
        'error.component': fullContext.component || 'unknown',
        'error.function': fullContext.function || 'unknown',
        'error.user_action': fullContext.userAction || 'unknown',
        'error.url': fullContext.url || '',
        'error.session_id': fullContext.sessionContext?.sessionId || '',
      });

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });

      // Log structured error
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: `Error tracked: ${error.message}`,
        attributes: {
          error_id: errorId,
          error_type: error.name,
          error_message: error.message,
          error_stack: error.stack,
          component: fullContext.component,
          function: fullContext.function,
          user_action: fullContext.userAction,
          url: fullContext.url,
          user_agent: fullContext.userAgent,
          session_id: fullContext.sessionContext?.sessionId,
          session_duration_ms: fullContext.sessionContext?.sessionDuration,
          custom_context: JSON.stringify(fullContext.customContext || {}),
          timestamp: new Date().toISOString(),
        },
      });

      // Call custom error handler if provided
      if (onError) {
        try {
          onError(error, fullContext);
        } catch (handlerError) {
          logger.emit({
            severityNumber: SeverityNumber.WARN,
            severityText: 'WARN',
            body: 'Error in custom error handler',
            attributes: {
              original_error_id: errorId,
              handler_error: (handlerError as Error).message,
            },
          });
        }
      }

      return errorId;
    } catch (trackingError) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Failed to track error: ${(trackingError as Error).message}`,
      });

      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'Failed to track error',
        attributes: {
          original_error: error.message,
          tracking_error: (trackingError as Error).message,
        },
      });

      return errorId; // Return ID even if tracking partially failed
    } finally {
      // Record error tracking duration
      const duration = performance.now() - startTime;
      errorDuration.record(duration, {
        error_type: error.name,
        tracking_success: 'true',
      });

      span.end();
    }
  }, [generateErrorId, captureContext, onError]);

  /**
   * Track an async error with proper span context
   */
  const trackAsyncError = useCallback(async (error: Error, context: Partial<ErrorContext> = {}): Promise<string> => {
    return new Promise((resolve) => {
      // Use setTimeout to ensure proper async context
      setTimeout(() => {
        const errorId = trackError(error, {
          ...context,
          function: context.function || 'async_operation',
        });
        resolve(errorId);
      }, 0);
    });
  }, [trackError]);

  /**
   * Attempt to recover from an error
   */
  const attemptRecovery = useCallback(async (errorId: string, recoveryAction?: () => Promise<void>): Promise<boolean> => {
    if (!enableRecovery) {
      return false;
    }

    const trackedError = errorHistory.current.get(errorId);
    if (!trackedError) {
      return false;
    }

    const currentAttempts = recoveryAttempts.current.get(errorId) || 0;
    if (currentAttempts >= maxRecoveryAttempts) {
      return false;
    }

    const span = tracer.startSpan('error_tracking.attempt_recovery', {
      attributes: {
        'error.id': errorId,
        'error.type': trackedError.error.name,
        'recovery.attempt': currentAttempts + 1,
        'recovery.max_attempts': maxRecoveryAttempts,
      },
    });

    try {
      errorStats.current.totalRecoveries++;
      recoveryAttempts.current.set(errorId, currentAttempts + 1);
      trackedError.recoveryAttempts = currentAttempts + 1;

      // Record recovery attempt
      errorRecoveryCounter.add(1, {
        error_type: trackedError.error.name,
        attempt_number: currentAttempts + 1,
      });

      let recoverySuccess = false;

      // Try custom recovery function first
      if (onRecovery) {
        try {
          recoverySuccess = await onRecovery(trackedError.error, trackedError.context, currentAttempts + 1);
        } catch (recoveryError) {
          logger.emit({
            severityNumber: SeverityNumber.WARN,
            severityText: 'WARN',
            body: 'Custom recovery function failed',
            attributes: {
              error_id: errorId,
              recovery_error: (recoveryError as Error).message,
            },
          });
        }
      }

      // Try provided recovery action if custom recovery didn't succeed
      if (!recoverySuccess && recoveryAction) {
        try {
          await recoveryAction();
          recoverySuccess = true;
        } catch (actionError) {
          logger.emit({
            severityNumber: SeverityNumber.WARN,
            severityText: 'WARN',
            body: 'Recovery action failed',
            attributes: {
              error_id: errorId,
              action_error: (actionError as Error).message,
            },
          });
        }
      }

      if (recoverySuccess) {
        errorStats.current.successfulRecoveries++;
      }

      span.setAttributes({
        'recovery.success': recoverySuccess,
        'recovery.completed_attempts': currentAttempts + 1,
      });

      logger.emit({
        severityNumber: recoverySuccess ? SeverityNumber.INFO : SeverityNumber.WARN,
        severityText: recoverySuccess ? 'INFO' : 'WARN',
        body: `Error recovery ${recoverySuccess ? 'succeeded' : 'failed'}`,
        attributes: {
          error_id: errorId,
          error_type: trackedError.error.name,
          recovery_attempt: currentAttempts + 1,
          recovery_success: recoverySuccess,
          max_attempts: maxRecoveryAttempts,
        },
      });

      return recoverySuccess;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Recovery attempt failed: ${(error as Error).message}`,
      });

      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'Error during recovery attempt',
        attributes: {
          error_id: errorId,
          recovery_error: (error as Error).message,
        },
      });

      return false;
    } finally {
      span.end();
    }
  }, [enableRecovery, maxRecoveryAttempts, onRecovery]);

  /**
   * Create an error boundary for a specific operation
   */
  const createErrorBoundary = useCallback(async <T>(
    operation: () => T | Promise<T>,
    context: Partial<ErrorContext> = {}
  ): Promise<T> => {
    const span = tracer.startSpan('error_tracking.error_boundary', {
      attributes: {
        'boundary.operation': context.function || 'unknown_operation',
        'boundary.component': context.component || 'unknown_component',
      },
    });

    try {
      const result = await operation();
      span.setAttributes({
        'boundary.success': true,
      });
      return result;
    } catch (error) {
      const errorId = trackError(error as Error, {
        ...context,
        function: context.function || 'error_boundary_operation',
      });

      span.setAttributes({
        'boundary.success': false,
        'boundary.error_id': errorId,
        'boundary.error_type': (error as Error).name,
      });

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });

      // If recovery is enabled, try to recover
      if (enableRecovery) {
        const recovered = await attemptRecovery(errorId);
        if (recovered) {
          span.setAttributes({
            'boundary.recovered': true,
          });
          
          // Try operation again after recovery
          try {
            const retryResult = await operation();
            return retryResult;
          } catch (retryError) {
            // Recovery didn't help, throw original error
            throw error;
          }
        }
      }

      throw error;
    } finally {
      span.end();
    }
  }, [trackError, enableRecovery, attemptRecovery]);

  /**
   * Get error statistics
   */
  const getErrorStats = useCallback(() => {
    return {
      ...errorStats.current,
      recentErrors: Array.from(errorHistory.current.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10), // Last 10 errors
    };
  }, []);

  /**
   * Clear error history
   */
  const clearErrorHistory = useCallback(() => {
    errorHistory.current.clear();
    recoveryAttempts.current.clear();
    errorStats.current = {
      totalErrors: 0,
      totalRecoveries: 0,
      successfulRecoveries: 0,
    };

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'Error tracking history cleared',
      attributes: {
        timestamp: new Date().toISOString(),
      },
    });
  }, []);

  // Set up global error handlers
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = new Error(event.reason?.message || 'Unhandled promise rejection');
      trackAsyncError(error, {
        component: 'global',
        function: 'unhandled_promise_rejection',
        customContext: { 
          reason: event.reason,
          promise: event.promise.toString(),
        },
      });
    };

    const handleError = (event: ErrorEvent) => {
      const error = new Error(event.message);
      error.stack = `${event.filename}:${event.lineno}:${event.colno}`;
      
      trackError(error, {
        component: 'global',
        function: 'unhandled_error',
        customContext: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', handleUnhandledRejection);
      window.addEventListener('error', handleError);

      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        window.removeEventListener('error', handleError);
      };
    }
  }, [trackError, trackAsyncError]);

  return {
    trackError,
    trackAsyncError,
    attemptRecovery,
    createErrorBoundary,
    getErrorStats,
    clearErrorHistory,
  };
}