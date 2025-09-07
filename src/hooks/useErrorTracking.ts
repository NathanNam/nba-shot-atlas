import { useCallback } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';

// Error tracking metrics
const errorCounter = meter.createCounter('app_errors_total', {
  description: 'Total number of application errors',
});

const errorRecoveryCounter = meter.createCounter('error_recoveries_total', {
  description: 'Total number of error recovery attempts',
});

const errorSeverityHistogram = meter.createHistogram('error_severity_distribution', {
  description: 'Distribution of error severities',
});

interface ErrorContext {
  componentName?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  additionalContext?: Record<string, any>;
}

interface ErrorInfo {
  message: string;
  stack?: string;
  name?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export function useErrorTracking() {
  const trackError = useCallback((error: ErrorInfo, context: ErrorContext = {}) => {
    const span = tracer.startSpan('error_tracking.track_error', {
      attributes: {
        'error.message': error.message,
        'error.name': error.name || 'UnknownError',
        'error.severity': error.severity || 'medium',
        'error.component': context.componentName || 'unknown',
        'error.user_id': context.userId || 'anonymous',
        'error.session_id': context.sessionId || 'unknown',
        'error.url': context.url || window.location.href,
      },
    });

    try {
      // Record error metrics
      errorCounter.add(1, {
        error_type: error.name || 'UnknownError',
        component: context.componentName || 'unknown',
        severity: error.severity || 'medium',
      });

      // Record severity distribution
      const severityScore = {
        low: 1,
        medium: 2,
        high: 3,
        critical: 4,
      }[error.severity || 'medium'];

      errorSeverityHistogram.record(severityScore, {
        error_type: error.name || 'UnknownError',
        component: context.componentName || 'unknown',
      });

      // Log detailed error information
      logger.emit({
        severityNumber: {
          low: SeverityNumber.INFO,
          medium: SeverityNumber.WARN,
          high: SeverityNumber.ERROR,
          critical: SeverityNumber.FATAL,
        }[error.severity || 'medium'],
        severityText: error.severity?.toUpperCase() || 'WARN',
        body: error.message,
        attributes: {
          error_name: error.name,
          error_stack: error.stack,
          error_severity: error.severity,
          component_name: context.componentName,
          user_id: context.userId,
          session_id: context.sessionId,
          user_agent: context.userAgent || navigator.userAgent,
          url: context.url || window.location.href,
          timestamp: new Date().toISOString(),
          ...context.additionalContext,
        },
      });

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });

      span.setAttributes({
        'error.tracked': true,
        'error.metric_recorded': true,
      });
    } finally {
      span.end();
    }
  }, []);

  const trackRecovery = useCallback((
    recoveryType: 'retry' | 'fallback' | 'refresh' | 'reset',
    originalError: string,
    context: ErrorContext = {}
  ) => {
    const span = tracer.startSpan('error_tracking.track_recovery', {
      attributes: {
        'recovery.type': recoveryType,
        'recovery.original_error': originalError,
        'recovery.component': context.componentName || 'unknown',
        'recovery.session_id': context.sessionId || 'unknown',
      },
    });

    try {
      errorRecoveryCounter.add(1, {
        recovery_type: recoveryType,
        component: context.componentName || 'unknown',
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: `Error recovery attempted: ${recoveryType}`,
        attributes: {
          recovery_type: recoveryType,
          original_error: originalError,
          component_name: context.componentName,
          session_id: context.sessionId,
          url: context.url || window.location.href,
          timestamp: new Date().toISOString(),
          ...context.additionalContext,
        },
      });

      span.setAttributes({
        'recovery.tracked': true,
      });
    } finally {
      span.end();
    }
  }, []);

  const trackUserReport = useCallback((
    issueDescription: string,
    reproductionSteps?: string[],
    context: ErrorContext = {}
  ) => {
    const span = tracer.startSpan('error_tracking.user_report', {
      attributes: {
        'user_report.description': issueDescription,
        'user_report.component': context.componentName || 'unknown',
        'user_report.session_id': context.sessionId || 'unknown',
      },
    });

    try {
      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'User reported issue',
        attributes: {
          issue_description: issueDescription,
          reproduction_steps: reproductionSteps?.join(' -> ') || 'not provided',
          component_name: context.componentName,
          user_id: context.userId,
          session_id: context.sessionId,
          url: context.url || window.location.href,
          user_agent: context.userAgent || navigator.userAgent,
          timestamp: new Date().toISOString(),
          ...context.additionalContext,
        },
      });

      span.setAttributes({
        'user_report.tracked': true,
      });
    } finally {
      span.end();
    }
  }, []);

  return {
    trackError,
    trackRecovery,
    trackUserReport,
  };
}