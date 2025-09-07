import React, { Component, ErrorInfo, ReactNode } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

// Metrics for error tracking
const errorCounter = meter.createCounter('react_errors_total', {
  description: 'Total number of React errors caught by error boundary',
});

const errorRecoveryCounter = meter.createCounter('react_error_recoveries_total', {
  description: 'Total number of error boundary recoveries',
});

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Get enhanced session context
    const sessionId = sessionStorage.getItem('nba_session_id') || 'unknown';
    const sessionStart = sessionStorage.getItem('nba_session_start');
    const sessionDuration = sessionStart ? Date.now() - parseInt(sessionStart) : 0;
    
    // Get performance context
    const performanceMemory = (performance as any).memory;
    const memoryInfo = performanceMemory ? {
      usedJSHeapSize: Math.round(performanceMemory.usedJSHeapSize / 1024 / 1024),
      totalJSHeapSize: Math.round(performanceMemory.totalJSHeapSize / 1024 / 1024),
      jsHeapSizeLimit: Math.round(performanceMemory.jsHeapSizeLimit / 1024 / 1024),
    } : {};

    // Get React DevTools info if available
    const reactVersion = (React as any).__version__ || 'unknown';
    const reactMode = process.env.NODE_ENV || 'unknown';

    const span = tracer.startSpan('error_boundary.component_error', {
      attributes: {
        'error.type': 'react_component_error',
        'error.name': error.name,
        'error.message': error.message,
        'error.stack': error.stack || 'No stack trace available',
        'error.component_stack': errorInfo.componentStack,
        'session.id': sessionId,
        'session.duration_ms': sessionDuration,
        'react.version': reactVersion,
        'react.mode': reactMode,
        'performance.memory_used_mb': memoryInfo.usedJSHeapSize || 0,
      },
    });

    try {
      // Record error metrics with enhanced context
      errorCounter.add(1, {
        error_name: error.name,
        error_type: 'component_error',
        session_duration_tier: sessionDuration < 30000 ? 'short' : sessionDuration < 300000 ? 'medium' : 'long',
        memory_usage_tier: (memoryInfo.usedJSHeapSize || 0) > 100 ? 'high' : (memoryInfo.usedJSHeapSize || 0) > 50 ? 'medium' : 'low',
      });

      // Log detailed error information with enhanced context
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'React component error caught by error boundary',
        attributes: {
          // Error details
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
          component_stack: errorInfo.componentStack,
          
          // Session context
          session_id: sessionId,
          session_duration_ms: sessionDuration,
          
          // Environment context
          user_agent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          react_version: reactVersion,
          react_mode: reactMode,
          
          // Performance context
          memory_info: memoryInfo,
          
          // Browser context
          viewport_size: `${window.innerWidth}x${window.innerHeight}`,
          screen_size: `${screen.width}x${screen.height}`,
          connection_type: (navigator as any).connection?.effectiveType || 'unknown',
          online_status: navigator.onLine,
          
          // NBA app specific context
          current_route: window.location.pathname,
          current_search: window.location.search,
          referrer: document.referrer,
          
          // Local storage context (safe extraction)
          has_cached_data: Boolean(localStorage.getItem('preloaded_data')),
          theme: localStorage.getItem('theme') || 'unknown',
        },
      });

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `React error: ${error.message}`,
      });

      // Store error info in state for display
      this.setState({ errorInfo });

      // Log to console for development
      console.error('Error Boundary caught an error:', error, errorInfo);
    } finally {
      span.end();
    }
  }

  handleRetry = () => {
    const span = tracer.startSpan('error_boundary.retry', {
      attributes: {
        'error.recovery_action': 'user_retry',
      },
    });

    try {
      errorRecoveryCounter.add(1, {
        recovery_type: 'user_retry',
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'User initiated error boundary retry',
        attributes: {
          previous_error: this.state.error?.message || 'Unknown error',
          url: window.location.href,
        },
      });

      // Reset error state
      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    } finally {
      span.end();
    }
  };

  handleReload = () => {
    const span = tracer.startSpan('error_boundary.reload', {
      attributes: {
        'error.recovery_action': 'page_reload',
      },
    });

    try {
      errorRecoveryCounter.add(1, {
        recovery_type: 'page_reload',
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'User initiated page reload from error boundary',
        attributes: {
          previous_error: this.state.error?.message || 'Unknown error',
          url: window.location.href,
        },
      });

      window.location.reload();
    } finally {
      span.end();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Card className="m-4 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">
              🏀 Something went wrong with the NBA Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">Error Details:</p>
              <p className="font-mono text-xs bg-muted p-2 rounded mt-2">
                {this.state.error?.message || 'Unknown error occurred'}
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={this.handleRetry} variant="outline">
                Try Again
              </Button>
              <Button onClick={this.handleReload} variant="destructive">
                Reload Page
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Component Stack (Development)
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-auto text-xs">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
