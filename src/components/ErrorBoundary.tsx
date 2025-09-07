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

// Metrics for error tracking - initialized lazily
let errorCounter: any;
let errorRecoveryCounter: any;

const initializeMetrics = () => {
  if (!errorCounter && meter?.createCounter) {
    errorCounter = meter.createCounter('react_errors_total', {
      description: 'Total number of React errors caught by error boundary',
    });

    errorRecoveryCounter = meter.createCounter('react_error_recoveries_total', {
      description: 'Total number of error boundary recoveries',
    });
  }
};

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
    // Gather enhanced context information
    const sessionId = sessionStorage.getItem('session-id') || 'unknown';
    const userId = localStorage.getItem('user-id') || 'anonymous';
    const performanceInfo = this.gatherPerformanceContext();
    const environmentInfo = this.gatherEnvironmentContext();
    const componentInfo = this.gatherComponentContext(errorInfo);

    const span = tracer.startSpan('error_boundary.component_error', {
      attributes: {
        'error.type': 'react_component_error',
        'error.name': error.name,
        'error.message': error.message,
        'error.stack': error.stack || 'No stack trace available',
        'error.component_stack': errorInfo.componentStack,
        'error.session_id': sessionId,
        'error.user_id': userId,
        'error.performance.memory_used_mb': performanceInfo.memoryUsedMB,
        'error.performance.connection_type': performanceInfo.connectionType,
        'error.environment.viewport': environmentInfo.viewport,
        'error.environment.device_type': environmentInfo.deviceType,
        'error.component.failed_component': componentInfo.failedComponent,
        'error.component.error_boundary_depth': componentInfo.errorBoundaryDepth,
      },
    });

    try {
      // Record error metrics with enhanced labels
      initializeMetrics();
      errorCounter?.add(1, {
        error_name: error.name,
        error_type: 'component_error',
        device_type: environmentInfo.deviceType,
        connection_type: performanceInfo.connectionType,
        component: componentInfo.failedComponent,
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
          
          // User context
          session_id: sessionId,
          user_id: userId,
          user_agent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          
          // Performance context
          memory_used_mb: performanceInfo.memoryUsedMB,
          memory_total_mb: performanceInfo.memoryTotalMB,
          connection_type: performanceInfo.connectionType,
          connection_effective_type: performanceInfo.connectionEffectiveType,
          
          // Environment context
          viewport: environmentInfo.viewport,
          screen_resolution: environmentInfo.screenResolution,
          device_type: environmentInfo.deviceType,
          color_scheme: environmentInfo.colorScheme,
          reduce_motion: environmentInfo.reduceMotion,
          
          // Component context
          failed_component: componentInfo.failedComponent,
          component_props_keys: componentInfo.componentPropsKeys,
          error_boundary_depth: componentInfo.errorBoundaryDepth,
          
          // Additional debugging info
          react_version: React.version,
          build_mode: process.env.NODE_ENV,
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
      initializeMetrics();
      errorRecoveryCounter?.add(1, {
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
      initializeMetrics();
      errorRecoveryCounter?.add(1, {
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

  // Helper method to gather performance context
  private gatherPerformanceContext() {
    const memoryInfo = (performance as any).memory;
    const connectionInfo = (navigator as any).connection;
    
    return {
      memoryUsedMB: memoryInfo ? Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024) : 0,
      memoryTotalMB: memoryInfo ? Math.round(memoryInfo.totalJSHeapSize / 1024 / 1024) : 0,
      connectionType: connectionInfo?.type || 'unknown',
      connectionEffectiveType: connectionInfo?.effectiveType || 'unknown',
    };
  }

  // Helper method to gather environment context
  private gatherEnvironmentContext() {
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screenResolution: `${screen.width}x${screen.height}`,
      deviceType: this.getDeviceType(),
      colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      reduceMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  }

  // Helper method to gather component context
  private gatherComponentContext(errorInfo: ErrorInfo) {
    const componentStack = errorInfo.componentStack;
    const failedComponent = this.extractFailedComponent(componentStack);
    
    return {
      failedComponent,
      componentPropsKeys: Object.keys(this.props).join(','),
      errorBoundaryDepth: this.getErrorBoundaryDepth(componentStack),
    };
  }

  // Extract the most likely failed component from the stack
  private extractFailedComponent(componentStack: string): string {
    const lines = componentStack.split('\n').filter(line => line.trim().length > 0);
    for (const line of lines) {
      const match = line.match(/in (\w+)/);
      if (match && match[1] !== 'ErrorBoundary') {
        return match[1];
      }
    }
    return 'unknown';
  }

  // Calculate error boundary depth in component tree
  private getErrorBoundaryDepth(componentStack: string): number {
    const boundaries = componentStack.split('\n')
      .filter(line => line.includes('ErrorBoundary') || line.includes('error'))
      .length;
    return boundaries;
  }

  // Determine device type based on user agent and screen size
  private getDeviceType(): string {
    const userAgent = navigator.userAgent;
    const screenWidth = screen.width;
    
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return screenWidth < 768 ? 'mobile' : 'tablet';
    }
    
    return screenWidth < 768 ? 'mobile' : screenWidth < 1024 ? 'tablet' : 'desktop';
  }

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
