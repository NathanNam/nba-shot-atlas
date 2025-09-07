import { useCallback } from 'react';
import { trace, SpanStatusCode, context } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

// Metrics for error tracking
const errorCounter = meter.createCounter('nba_errors_total', {
  description: 'Total number of errors',
});

const errorRateGauge = meter.createHistogram('nba_error_rate', {
  description: 'Error rate over time',
  unit: '1',
});

const recoveryTimeHistogram = meter.createHistogram('nba_error_recovery_time_seconds', {
  description: 'Time to recover from errors',
  unit: 's',
});

export interface ErrorMetadata {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  timestamp?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable?: boolean;
  context?: Record<string, any>;
}

export interface ErrorBoundaryInfo {
  componentStack?: string;
  errorBoundary?: string;
  errorInfo?: any;
}

export interface NetworkErrorMetadata extends ErrorMetadata {
  endpoint: string;
  method: string;
  statusCode?: number;
  responseBody?: string;
  retryAttempt?: number;
}

export interface ValidationErrorMetadata extends ErrorMetadata {
  field: string;
  value: any;
  rule: string;
  expectedFormat?: string;
}

export function useErrorTracking() {
  // Track general application errors
  const trackError = useCallback(
    (error: Error, metadata: ErrorMetadata, errorBoundaryInfo?: ErrorBoundaryInfo) => {
      const span = tracer.startSpan('app.error', {
        attributes: {
          'error.type': error.name,
          'error.message': error.message,
          'error.stack': error.stack || '',
          'error.component': metadata.component || 'unknown',
          'error.action': metadata.action || 'unknown',
          'error.severity': metadata.severity,
          'error.recoverable': metadata.recoverable || false,
          'error.user_id': metadata.userId || 'anonymous',
          'error.session_id': metadata.sessionId || 'unknown',
          'error.url': metadata.url || window.location.href,
          'error.user_agent': metadata.userAgent || navigator.userAgent,
          'error.timestamp': metadata.timestamp || Date.now(),
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        try {
          // Record error metrics
          errorCounter.add(1, {
            component: metadata.component || 'unknown',
            error_type: error.name,
            severity: metadata.severity,
            recoverable: metadata.recoverable?.toString() || 'false',
          });

          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });

          // Add error boundary info if available
          if (errorBoundaryInfo) {
            span.setAttributes({
              'error.component_stack': errorBoundaryInfo.componentStack || '',
              'error.boundary': errorBoundaryInfo.errorBoundary || '',
              'error.boundary_info': JSON.stringify(errorBoundaryInfo.errorInfo || {}),
            });
          }

          const logSeverity = getSeverityFromErrorSeverity(metadata.severity);
          
          logger.emit({
            severityNumber: logSeverity,
            severityText: getSeverityText(logSeverity),
            body: `Application error: ${error.message}`,
            attributes: {
              'error_type': error.name,
              'error_message': error.message,
              'error_stack': error.stack || '',
              'component': metadata.component || 'unknown',
              'action': metadata.action || 'unknown',
              'severity': metadata.severity,
              'recoverable': metadata.recoverable || false,
              'user_id': metadata.userId || 'anonymous',
              'session_id': metadata.sessionId || 'unknown',
              'url': metadata.url || window.location.href,
              'user_agent': metadata.userAgent || navigator.userAgent,
              'timestamp': metadata.timestamp || Date.now(),
              'context': JSON.stringify(metadata.context || {}),
              'trace_id': span.spanContext().traceId,
              'span_id': span.spanContext().spanId,
              ...(errorBoundaryInfo || {}),
            },
          });
        } catch (loggingError) {
          console.error('Failed to log error:', loggingError);
        } finally {
          span.end();
        }
      });
    },
    []
  );

  // Track network/API errors specifically
  const trackNetworkError = useCallback(
    (error: Error, metadata: NetworkErrorMetadata) => {
      const span = tracer.startSpan('network.error', {
        attributes: {
          'error.type': error.name,
          'error.message': error.message,
          'network.endpoint': metadata.endpoint,
          'network.method': metadata.method,
          'network.status_code': metadata.statusCode || 0,
          'network.retry_attempt': metadata.retryAttempt || 0,
          'error.severity': metadata.severity,
          'error.component': metadata.component || 'unknown',
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        errorCounter.add(1, {
          component: metadata.component || 'network',
          error_type: 'network_error',
          severity: metadata.severity,
          endpoint: metadata.endpoint,
          method: metadata.method,
        });

        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });

        const logSeverity = getSeverityFromErrorSeverity(metadata.severity);
        
        logger.emit({
          severityNumber: logSeverity,
          severityText: getSeverityText(logSeverity),
          body: `Network error: ${error.message} for ${metadata.method} ${metadata.endpoint}`,
          attributes: {
            'error_type': error.name,
            'error_message': error.message,
            'endpoint': metadata.endpoint,
            'method': metadata.method,
            'status_code': metadata.statusCode || 0,
            'response_body': metadata.responseBody || '',
            'retry_attempt': metadata.retryAttempt || 0,
            'severity': metadata.severity,
            'component': metadata.component || 'network',
            'session_id': metadata.sessionId || 'unknown',
            'trace_id': span.spanContext().traceId,
            'span_id': span.spanContext().spanId,
          },
        });

        span.end();
      });
    },
    []
  );

  // Track validation errors
  const trackValidationError = useCallback(
    (error: Error, metadata: ValidationErrorMetadata) => {
      const span = tracer.startSpan('validation.error', {
        attributes: {
          'error.type': 'validation_error',
          'error.message': error.message,
          'validation.field': metadata.field,
          'validation.rule': metadata.rule,
          'validation.value': JSON.stringify(metadata.value),
          'validation.expected_format': metadata.expectedFormat || '',
          'error.component': metadata.component || 'unknown',
          'error.severity': metadata.severity,
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        errorCounter.add(1, {
          component: metadata.component || 'validation',
          error_type: 'validation_error',
          severity: metadata.severity,
          field: metadata.field,
          rule: metadata.rule,
        });

        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });

        logger.emit({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: `Validation error: ${error.message} for field ${metadata.field}`,
          attributes: {
            'error_type': 'validation_error',
            'error_message': error.message,
            'field': metadata.field,
            'rule': metadata.rule,
            'value': JSON.stringify(metadata.value),
            'expected_format': metadata.expectedFormat || '',
            'component': metadata.component || 'validation',
            'severity': metadata.severity,
            'trace_id': span.spanContext().traceId,
            'span_id': span.spanContext().spanId,
          },
        });

        span.end();
      });
    },
    []
  );

  // Track error recovery
  const trackErrorRecovery = useCallback(
    (originalError: Error, recoveryAction: string, metadata: ErrorMetadata, success: boolean) => {
      const span = tracer.startSpan('error.recovery', {
        attributes: {
          'recovery.action': recoveryAction,
          'recovery.success': success,
          'recovery.original_error': originalError.message,
          'recovery.component': metadata.component || 'unknown',
          'error.severity': metadata.severity,
        },
      });

      context.with(trace.setSpan(context.active(), span), () => {
        if (success) {
          recoveryTimeHistogram.record(
            metadata.timestamp ? (Date.now() - metadata.timestamp) / 1000 : 0,
            {
              component: metadata.component || 'unknown',
              recovery_action: recoveryAction,
            }
          );
        }

        const logSeverity = success ? SeverityNumber.INFO : SeverityNumber.WARN;
        
        logger.emit({
          severityNumber: logSeverity,
          severityText: success ? 'INFO' : 'WARN',
          body: `Error recovery ${success ? 'succeeded' : 'failed'}: ${recoveryAction}`,
          attributes: {
            'recovery_action': recoveryAction,
            'recovery_success': success,
            'original_error': originalError.message,
            'component': metadata.component || 'unknown',
            'severity': metadata.severity,
            'session_id': metadata.sessionId || 'unknown',
            'trace_id': span.spanContext().traceId,
            'span_id': span.spanContext().spanId,
          },
        });

        span.setStatus({ code: success ? SpanStatusCode.OK : SpanStatusCode.ERROR });
        span.end();
      });
    },
    []
  );

  // Create an error context for better debugging
  const createErrorContext = useCallback(
    (component?: string, action?: string, additionalContext?: Record<string, any>) => {
      return {
        component: component || 'unknown',
        action: action || 'unknown',
        userId: 'anonymous', // Could be retrieved from auth context
        sessionId: `session_${Date.now()}`, // Could be retrieved from session context
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: Date.now(),
        context: {
          ...additionalContext,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
          memory: 'memory' in performance ? (performance as any).memory?.usedJSHeapSize : undefined,
        },
      };
    },
    []
  );

  // Wrap async functions with error tracking
  const withErrorTracking = useCallback(
    <T>(
      fn: () => Promise<T>,
      errorContext: Partial<ErrorMetadata>,
      onError?: (error: Error) => void
    ): Promise<T> => {
      return fn().catch((error) => {
        const fullContext: ErrorMetadata = {
          severity: 'medium',
          recoverable: true,
          ...createErrorContext(errorContext.component, errorContext.action),
          ...errorContext,
        };

        trackError(error, fullContext);
        
        if (onError) {
          onError(error);
        }
        
        throw error;
      });
    },
    [trackError, createErrorContext]
  );

  return {
    trackError,
    trackNetworkError,
    trackValidationError,
    trackErrorRecovery,
    createErrorContext,
    withErrorTracking,
  };
}

// Helper functions
function getSeverityFromErrorSeverity(severity: string): SeverityNumber {
  switch (severity) {
    case 'critical':
      return SeverityNumber.FATAL;
    case 'high':
      return SeverityNumber.ERROR;
    case 'medium':
      return SeverityNumber.WARN;
    case 'low':
      return SeverityNumber.INFO;
    default:
      return SeverityNumber.WARN;
  }
}

function getSeverityText(severity: SeverityNumber): string {
  switch (severity) {
    case SeverityNumber.FATAL:
      return 'FATAL';
    case SeverityNumber.ERROR:
      return 'ERROR';
    case SeverityNumber.WARN:
      return 'WARN';
    case SeverityNumber.INFO:
      return 'INFO';
    default:
      return 'WARN';
  }
}