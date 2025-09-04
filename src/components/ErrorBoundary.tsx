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
    const span = tracer.startSpan('error_boundary.component_error', {
      attributes: {
        'error.type': 'react_component_error',
        'error.name': error.name,
        'error.message': error.message,
        'error.stack': error.stack || 'No stack trace available',
        'error.component_stack': errorInfo.componentStack,
      },
    });

    try {
      // Record error metrics
      errorCounter.add(1, {
        error_name: error.name,
        error_type: 'component_error',
      });

      // Log detailed error information
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'React component error caught by error boundary',
        attributes: {
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
          component_stack: errorInfo.componentStack,
          user_agent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
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
