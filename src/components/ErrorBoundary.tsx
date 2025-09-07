import React, { Component, ErrorInfo, ReactNode } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { PerformanceMonitor, trackComponentError } from './PerformanceMonitor';

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
    const span = tracer.startSpan('error_boundary.enhanced_component_error', {
      attributes: {
        'error.type': 'react_component_error',
        'error.name': error.name,
        'error.message': error.message,
        'error.stack': error.stack || 'No stack trace available',
        'error.component_stack': errorInfo.componentStack,
      },
    });

    try {
      // Enhanced session context
      const sessionContext = {
        url: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString(),
        session_storage_length: sessionStorage.length,
        local_storage_length: localStorage.length,
        document_title: document.title,
        referrer: document.referrer,
        connection: (navigator as any).connection ? {
          effective_type: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink,
          rtt: (navigator as any).connection.rtt,
        } : 'not_available',
      };

      // Enhanced error metrics with more context
      const enhancedErrorCounter = meter.createCounter('enhanced_react_errors_total', {
        description: 'Enhanced React errors with full session context',
      });

      // Record enhanced error metrics
      errorCounter.add(1, {
        error_name: error.name,
        error_type: 'component_error',
      });

      enhancedErrorCounter.add(1, {
        error_name: error.name,
        error_type: 'enhanced_component_error',
        url_pathname: window.location.pathname,
        user_agent_platform: navigator.platform,
        has_component_stack: errorInfo.componentStack ? 'true' : 'false',
      });

      // Enhanced logging with comprehensive context
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'Enhanced React component error caught by error boundary',
        attributes: {
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
          component_stack: errorInfo.componentStack,
          session_context: JSON.stringify(sessionContext),
          memory_usage: (performance as any).memory ? {
            used_heap_size: (performance as any).memory.usedJSHeapSize,
            total_heap_size: (performance as any).memory.totalJSHeapSize,
            heap_size_limit: (performance as any).memory.jsHeapSizeLimit,
          } : 'not_available',
          performance_entries: JSON.stringify({
            navigation: performance.getEntriesByType('navigation')[0] || 'not_available',
            resource_count: performance.getEntriesByType('resource').length,
          }),
        },
      });

      // Use the performance monitor's error tracking
      trackComponentError('ErrorBoundary', error.message, error.stack);

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Enhanced React error: ${error.message}`,
      });

      span.setAttributes({
        'error.session_context': JSON.stringify(sessionContext),
        'error.enhanced_tracking': true,
        'error.component_tree_depth': (errorInfo.componentStack.match(/\n/g) || []).length,
      });

      // Store error info in state for display
      this.setState({ errorInfo });

      // Log to console for development with enhanced context
      console.error('Enhanced Error Boundary caught an error:', error, errorInfo, sessionContext);
    } finally {
      span.end();
    }
  }

  handleRetry = () => {
    const span = tracer.startSpan('error_boundary.enhanced_retry', {
      attributes: {
        'error.recovery_action': 'user_retry',
        'error.previous_message': this.state.error?.message || 'Unknown',
        'error.recovery_timestamp': Date.now(),
      },
    });

    try {
      const enhancedRecoveryCounter = meter.createCounter('enhanced_error_recovery_total', {
        description: 'Enhanced error recovery with context',
      });

      errorRecoveryCounter.add(1, {
        recovery_type: 'user_retry',
      });

      enhancedRecoveryCounter.add(1, {
        recovery_type: 'user_retry_enhanced',
        previous_error_type: this.state.error?.name || 'unknown',
        url_pathname: window.location.pathname,
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Enhanced user initiated error boundary retry',
        attributes: {
          previous_error: this.state.error?.message || 'Unknown error',
          previous_error_name: this.state.error?.name || 'Unknown',
          previous_error_stack: this.state.error?.stack || 'No stack',
          component_stack: this.state.errorInfo?.componentStack || 'No component stack',
          url: window.location.href,
          recovery_timestamp: new Date().toISOString(),
          session_duration: Date.now(),
        },
      });

      span.setAttributes({
        'error.recovery_success': true,
        'error.recovery_context': JSON.stringify({
          previous_error: this.state.error?.message,
          component_stack_depth: (this.state.errorInfo?.componentStack.match(/\n/g) || []).length,
        }),
      });

      // Reset error state
      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    } finally {
      span.end();
    }
  };

  handleReload = () => {
    const span = tracer.startSpan('error_boundary.enhanced_reload', {
      attributes: {
        'error.recovery_action': 'page_reload',
        'error.previous_message': this.state.error?.message || 'Unknown',
        'error.reload_timestamp': Date.now(),
      },
    });

    try {
      const enhancedRecoveryCounter = meter.createCounter('enhanced_error_recovery_total', {
        description: 'Enhanced error recovery with context',
      });

      errorRecoveryCounter.add(1, {
        recovery_type: 'page_reload',
      });

      enhancedRecoveryCounter.add(1, {
        recovery_type: 'page_reload_enhanced',
        previous_error_type: this.state.error?.name || 'unknown',
        url_pathname: window.location.pathname,
      });

      logger.emit({
        severityNumber: SeverityNumber.WARN, // Elevated severity for page reload
        severityText: 'WARN',
        body: 'Enhanced user initiated page reload from error boundary',
        attributes: {
          previous_error: this.state.error?.message || 'Unknown error',
          previous_error_name: this.state.error?.name || 'Unknown',
          previous_error_stack: this.state.error?.stack || 'No stack',
          component_stack: this.state.errorInfo?.componentStack || 'No component stack',
          url: window.location.href,
          reload_timestamp: new Date().toISOString(),
          recovery_type: 'full_page_reload',
          session_context: JSON.stringify({
            pathname: window.location.pathname,
            search: window.location.search,
            user_agent: navigator.userAgent,
          }),
        },
      });

      span.setAttributes({
        'error.recovery_type': 'full_page_reload',
        'error.recovery_severity': 'high',
        'error.requires_full_reset': true,
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
        <PerformanceMonitor componentName="ErrorBoundary_ErrorState">
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
        </PerformanceMonitor>
      );
    }

    return (
      <PerformanceMonitor componentName="ErrorBoundary_NormalState">
        {this.props.children}
      </PerformanceMonitor>
    );
  }
}

export default ErrorBoundary;
