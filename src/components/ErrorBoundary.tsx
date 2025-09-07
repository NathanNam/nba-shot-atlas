import React, { Component, ErrorInfo, ReactNode } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertTriangle, RefreshCw, RotateCcw, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  sessionInfo?: {
    sessionId: string;
    timestamp: number;
    userAgent: string;
    viewport: { width: number; height: number };
    url: string;
    memory?: number;
    connectionType?: string;
  };
  retryCount: number;
}

// Enhanced metrics for error tracking
const errorCounter = meter.createCounter('react_errors_total', {
  description: 'Total number of React errors caught by error boundary',
});

const errorRecoveryCounter = meter.createCounter('react_error_recoveries_total', {
  description: 'Total number of error boundary recoveries',
});

const errorSeverityHistogram = meter.createHistogram('error_severity_distribution', {
  description: 'Distribution of error severities',
});

const errorRecoveryTimeHistogram = meter.createHistogram('error_recovery_time_seconds', {
  description: 'Time between error occurrence and recovery attempt',
  unit: 's',
});

const errorContextCounter = meter.createCounter('error_context_types_total', {
  description: 'Types of error contexts encountered',
});

class ErrorBoundary extends Component<Props, State> {
  private errorOccurrenceTime: number = 0;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  private captureSessionInfo() {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let memory = 0;
    if ('memory' in performance && 'usedJSHeapSize' in (performance as any).memory) {
      memory = (performance as any).memory.usedJSHeapSize;
    }

    let connectionType = 'unknown';
    if ('connection' in navigator) {
      connectionType = (navigator as any).connection?.effectiveType || 'unknown';
    }

    return {
      sessionId,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      url: window.location.href,
      memory,
      connectionType,
    };
  }

  private categorizeError(error: Error): { severity: 'low' | 'medium' | 'high' | 'critical', category: string } {
    const errorMessage = error.message.toLowerCase();
    const errorStack = (error.stack || '').toLowerCase();

    // Critical errors that break core functionality
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('load')) {
      return { severity: 'critical', category: 'network' };
    }
    
    if (errorMessage.includes('memory') || errorStack.includes('out of memory')) {
      return { severity: 'critical', category: 'memory' };
    }

    if (errorMessage.includes('chunk') || errorMessage.includes('loading')) {
      return { severity: 'high', category: 'loading' };
    }

    // NBA-specific errors
    if (errorMessage.includes('player') || errorMessage.includes('team') || errorMessage.includes('stats')) {
      return { severity: 'medium', category: 'nba_data' };
    }

    if (errorMessage.includes('chart') || errorMessage.includes('render')) {
      return { severity: 'medium', category: 'visualization' };
    }

    // UI/Component errors
    if (errorStack.includes('react') || errorMessage.includes('component')) {
      return { severity: 'medium', category: 'component' };
    }

    // Default categorization
    return { severity: 'low', category: 'general' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.errorOccurrenceTime = Date.now();
    const sessionInfo = this.captureSessionInfo();
    const { severity, category } = this.categorizeError(error);
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
      // Record enhanced error metrics
      errorCounter.add(1, {
        error_name: error.name,
        error_type: 'component_error',
        error_category: category,
        error_severity: severity,
      });

      errorSeverityHistogram.record(severity === 'critical' ? 4 : severity === 'high' ? 3 : severity === 'medium' ? 2 : 1, {
        error_category: category,
        error_name: error.name,
      });

      errorContextCounter.add(1, {
        context_type: category,
        has_session_info: 'true',
        has_memory_info: sessionInfo.memory ? 'true' : 'false',
        connection_type: sessionInfo.connectionType,
      });

      // Log comprehensive error information
      const logSeverity = severity === 'critical' ? SeverityNumber.FATAL : 
                         severity === 'high' ? SeverityNumber.ERROR : 
                         severity === 'medium' ? SeverityNumber.WARN : SeverityNumber.INFO;
      
      logger.emit({
        severityNumber: logSeverity,
        severityText: logSeverity === SeverityNumber.FATAL ? 'FATAL' : 
                     logSeverity === SeverityNumber.ERROR ? 'ERROR' : 
                     logSeverity === SeverityNumber.WARN ? 'WARN' : 'INFO',
        body: `React component error [${severity.toUpperCase()}]: ${error.message}`,
        attributes: {
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
          error_severity: severity,
          error_category: category,
          component_stack: errorInfo.componentStack,
          session_id: sessionInfo.sessionId,
          user_agent: sessionInfo.userAgent,
          url: sessionInfo.url,
          viewport_width: sessionInfo.viewport.width,
          viewport_height: sessionInfo.viewport.height,
          memory_usage: sessionInfo.memory,
          connection_type: sessionInfo.connectionType,
          timestamp: new Date().toISOString(),
          retry_count: this.state.retryCount,
        },
      });

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `React error: ${error.message}`,
      });

      // Store comprehensive error info in state for display
      this.setState({ errorInfo, sessionInfo });

      // Log to console for development
      console.error('Error Boundary caught an error:', error, errorInfo);
    } finally {
      span.end();
    }
  }

  private getRecoverySuggestions(error?: Error): string[] {
    const suggestions = [];
    const errorMessage = error?.message.toLowerCase() || '';
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      suggestions.push('Check your internet connection');
      suggestions.push('Try refreshing the page');
    }
    
    if (errorMessage.includes('chunk') || errorMessage.includes('loading')) {
      suggestions.push('Clear your browser cache');
      suggestions.push('Try a hard refresh (Ctrl+F5)');
    }
    
    if (errorMessage.includes('memory')) {
      suggestions.push('Close other browser tabs');
      suggestions.push('Restart your browser');
    }
    
    if (errorMessage.includes('player') || errorMessage.includes('stats')) {
      suggestions.push('Try selecting a different player or team');
      suggestions.push('Wait a moment and try again');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('Try refreshing the page');
      suggestions.push('Clear your browser cache and try again');
    }
    
    return suggestions;
  }

  handleRetry = () => {
    const recoveryTime = this.errorOccurrenceTime ? (Date.now() - this.errorOccurrenceTime) / 1000 : 0;
    const span = tracer.startSpan('error_boundary.retry', {
      attributes: {
        'error.recovery_action': 'user_retry',
      },
    });

    try {
      errorRecoveryCounter.add(1, {
        recovery_type: 'user_retry',
        retry_count: this.state.retryCount.toString(),
        error_category: this.categorizeError(this.state.error!).category,
      });

      if (recoveryTime > 0) {
        errorRecoveryTimeHistogram.record(recoveryTime, {
          recovery_type: 'user_retry',
          error_category: this.categorizeError(this.state.error!).category,
        });
      }

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'User initiated error boundary retry',
        attributes: {
          previous_error: this.state.error?.message || 'Unknown error',
          previous_error_category: this.categorizeError(this.state.error!).category,
          retry_count: this.state.retryCount,
          recovery_time_seconds: recoveryTime,
          url: window.location.href,
          session_id: this.state.sessionInfo?.sessionId,
        },
      });

      // Reset error state with incremented retry count
      this.setState({ 
        hasError: false, 
        error: undefined, 
        errorInfo: undefined, 
        sessionInfo: undefined,
        retryCount: this.state.retryCount + 1
      });
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
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                🏀 NBA Analytics Error
                <Badge variant="destructive" className="ml-auto">
                  {this.categorizeError(this.state.error!).severity.toUpperCase()}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <div className="flex items-center gap-2 mb-2">
                  <Bug className="h-4 w-4" />
                  <p className="font-medium">Error Details:</p>
                  <Badge variant="outline">{this.categorizeError(this.state.error!).category}</Badge>
                </div>
                <p className="font-mono text-xs bg-muted p-2 rounded">
                  {this.state.error?.message || 'Unknown error occurred'}
                </p>
              </div>

              {this.state.sessionInfo && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">Session Info:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Session: {this.state.sessionInfo.sessionId.slice(-8)}</div>
                    <div>Retries: {this.state.retryCount}</div>
                    <div>Viewport: {this.state.sessionInfo.viewport.width}×{this.state.sessionInfo.viewport.height}</div>
                    <div>Memory: {this.state.sessionInfo.memory ? Math.round(this.state.sessionInfo.memory / 1024 / 1024) + 'MB' : 'N/A'}</div>
                  </div>
                </div>
              )}

              <div className="text-sm">
                <p className="font-medium mb-2">Recovery Suggestions:</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                  {this.getRecoverySuggestions(this.state.error).map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={this.handleRetry} variant="outline" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Try Again {this.state.retryCount > 0 && `(${this.state.retryCount + 1})`}
              </Button>
              <Button onClick={this.handleReload} variant="destructive" className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
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
