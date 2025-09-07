import React, { Component, ErrorInfo, ReactNode } from 'react';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertTriangle, RefreshCw, Bug, Info, Copy, ExternalLink } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  sessionContext?: Record<string, any>;
  userActions?: Array<{
    action: string;
    timestamp: number;
    details?: Record<string, any>;
  }>;
  retryCount: number;
}

// Metrics for error tracking
const errorCounter = meter.createCounter('react_errors_total', {
  description: 'Total number of React errors caught by error boundary',
});

const errorRecoveryCounter = meter.createCounter('react_error_recoveries_total', {
  description: 'Total number of error boundary recoveries',
});

const errorSeverityCounter = meter.createCounter('react_error_severity_total', {
  description: 'Total number of errors by severity level',
});

const errorRetryCounter = meter.createCounter('react_error_retries_total', {
  description: 'Total number of error retry attempts',
});

const errorContextSize = meter.createHistogram('react_error_context_size_bytes', {
  description: 'Size of error context data in bytes',
  unit: 'By',
});

const errorSessionDuration = meter.createHistogram('react_error_session_duration_ms', {
  description: 'Duration of user session before error occurred',
  unit: 'ms',
});

class ErrorBoundary extends Component<Props, State> {
  private sessionStartTime = Date.now();
  private userActions: Array<{ action: string; timestamp: number; details?: Record<string, any> }> = [];

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      retryCount: 0,
    };
    
    // Track user interactions globally for context
    if (typeof window !== 'undefined') {
      this.setupUserActionTracking();
    }
  }

  private setupUserActionTracking() {
    const trackAction = (action: string, details?: Record<string, any>) => {
      const actionData = {
        action,
        timestamp: Date.now(),
        details,
      };
      
      this.userActions.push(actionData);
      
      // Keep only last 50 actions to prevent memory bloat
      if (this.userActions.length > 50) {
        this.userActions = this.userActions.slice(-50);
      }
    };

    // Track various user interactions
    window.addEventListener('click', (e) => {
      const target = e.target as Element;
      trackAction('click', {
        tag: target?.tagName?.toLowerCase(),
        className: target?.className,
        id: target?.id,
        text: target?.textContent?.slice(0, 50),
      });
    });

    window.addEventListener('keydown', (e) => {
      trackAction('keydown', {
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
      });
    });

    window.addEventListener('scroll', () => {
      trackAction('scroll', {
        scrollY: window.scrollY,
        scrollX: window.scrollX,
      });
    });

    // Track route changes if using React Router
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      trackAction('navigation', { 
        type: 'pushState', 
        url: args[2]?.toString() 
      });
      return originalPushState.apply(history, args);
    };
    
    history.replaceState = function(...args) {
      trackAction('navigation', { 
        type: 'replaceState', 
        url: args[2]?.toString() 
      });
      return originalReplaceState.apply(history, args);
    };

    window.addEventListener('popstate', (e) => {
      trackAction('navigation', { 
        type: 'popstate', 
        url: window.location.href 
      });
    });
  }

  private collectSessionContext(): Record<string, any> {
    const sessionDuration = Date.now() - this.sessionStartTime;
    
    return {
      session_duration_ms: sessionDuration,
      user_agent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer || 'direct',
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
      },
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      memory: (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
      } : undefined,
    };
  }

  private determineErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name?.toLowerCase() || '';
    
    // Critical errors that completely break the app
    if (errorName.includes('chunkloaderror') || 
        errorMessage.includes('loading chunk') ||
        errorMessage.includes('loading css chunk')) {
      return 'critical';
    }
    
    // High severity errors
    if (errorName.includes('typeerror') || 
        errorName.includes('referenceerror') ||
        errorMessage.includes('cannot read property') ||
        errorMessage.includes('is not a function')) {
      return 'high';
    }
    
    // Medium severity errors
    if (errorMessage.includes('network') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('timeout')) {
      return 'medium';
    }
    
    // Default to medium for unknown errors
    return 'medium';
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Generate unique error ID
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const sessionContext = this.collectSessionContext();
    const errorSeverity = this.determineErrorSeverity(error);
    const errorId = this.state.errorId || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const span = tracer.startSpan('error_boundary.component_error', {
      attributes: {
        'error.id': errorId,
        'error.type': 'react_component_error',
        'error.name': error.name,
        'error.message': error.message,
        'error.severity': errorSeverity,
        'error.stack': error.stack || 'No stack trace available',
        'error.component_stack': errorInfo.componentStack,
        'error.session_duration_ms': sessionContext.session_duration_ms,
        'error.url': sessionContext.url,
        'error.user_actions_count': this.userActions.length,
      },
    });

    try {
      // Calculate context size for metrics
      const contextData = {
        sessionContext,
        userActions: this.userActions.slice(-10), // Last 10 actions
        errorInfo,
      };
      const contextSize = new TextEncoder().encode(JSON.stringify(contextData)).length;

      // Record comprehensive error metrics
      errorCounter.add(1, {
        error_name: error.name,
        error_type: 'component_error',
        error_severity: errorSeverity,
      });

      errorSeverityCounter.add(1, {
        severity: errorSeverity,
        error_type: 'react_error',
      });

      errorContextSize.record(contextSize, {
        error_type: error.name,
        severity: errorSeverity,
      });

      errorSessionDuration.record(sessionContext.session_duration_ms as number, {
        error_type: error.name,
        severity: errorSeverity,
      });

      // Log comprehensive error information
      logger.emit({
        severityNumber: errorSeverity === 'critical' ? SeverityNumber.FATAL :
                       errorSeverity === 'high' ? SeverityNumber.ERROR :
                       errorSeverity === 'medium' ? SeverityNumber.WARN : SeverityNumber.INFO,
        severityText: errorSeverity.toUpperCase(),
        body: 'React component error caught by error boundary',
        attributes: {
          error_id: errorId,
          error_name: error.name,
          error_message: error.message,
          error_severity: errorSeverity,
          error_stack: error.stack || 'No stack trace',
          component_stack: errorInfo.componentStack,
          session_context: JSON.stringify(sessionContext),
          user_actions: JSON.stringify(this.userActions.slice(-10)),
          context_size_bytes: contextSize,
          retry_count: this.state.retryCount,
          trace_id: span.spanContext().traceId,
          span_id: span.spanContext().spanId,
        },
      });

      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `React error (${errorSeverity}): ${error.message}`,
      });

      // Store comprehensive error info in state for display
      this.setState({ 
        errorInfo,
        errorId,
        sessionContext,
        userActions: [...this.userActions],
      });

      // Log to console for development
      console.group(`🚨 Error Boundary caught an error (${errorSeverity})`);
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Session Context:', sessionContext);
      console.error('Recent User Actions:', this.userActions.slice(-5));
      console.groupEnd();

    } finally {
      span.end();
    }
  }

  handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    const span = tracer.startSpan('error_boundary.retry', {
      attributes: {
        'error.recovery_action': 'user_retry',
        'error.retry_count': newRetryCount,
        'error.error_id': this.state.errorId || 'unknown',
      },
    });

    try {
      errorRecoveryCounter.add(1, {
        recovery_type: 'user_retry',
        retry_count: newRetryCount.toString(),
      });

      errorRetryCounter.add(1, {
        error_type: this.state.error?.name || 'unknown',
        retry_count: newRetryCount.toString(),
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'User initiated error boundary retry',
        attributes: {
          error_id: this.state.errorId || 'unknown',
          previous_error: this.state.error?.message || 'Unknown error',
          retry_count: newRetryCount,
          session_duration_ms: Date.now() - this.sessionStartTime,
          url: window.location.href,
          trace_id: span.spanContext().traceId,
          span_id: span.spanContext().spanId,
        },
      });

      // Reset error state but keep retry count
      this.setState({ 
        hasError: false, 
        error: undefined, 
        errorInfo: undefined,
        errorId: undefined,
        sessionContext: undefined,
        userActions: undefined,
        retryCount: newRetryCount,
      });
      
      span.setStatus({ code: SpanStatusCode.OK });
    } finally {
      span.end();
    }
  };

  handleReload = () => {
    const span = tracer.startSpan('error_boundary.reload', {
      attributes: {
        'error.recovery_action': 'page_reload',
        'error.error_id': this.state.errorId || 'unknown',
      },
    });

    try {
      errorRecoveryCounter.add(1, {
        recovery_type: 'page_reload',
        error_severity: this.determineErrorSeverity(this.state.error || new Error('Unknown')),
      });

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'User initiated page reload from error boundary',
        attributes: {
          error_id: this.state.errorId || 'unknown',
          previous_error: this.state.error?.message || 'Unknown error',
          retry_count: this.state.retryCount,
          session_duration_ms: Date.now() - this.sessionStartTime,
          url: window.location.href,
          trace_id: span.spanContext().traceId,
          span_id: span.spanContext().spanId,
        },
      });

      window.location.reload();
    } finally {
      span.end();
    }
  };

  private copyErrorDetails = () => {
    const errorDetails = {
      errorId: this.state.errorId,
      error: {
        name: this.state.error?.name,
        message: this.state.error?.message,
        stack: this.state.error?.stack?.split('\n').slice(0, 5).join('\n'), // First 5 lines
      },
      sessionContext: this.state.sessionContext,
      recentActions: this.state.userActions?.slice(-5),
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2)).then(() => {
      // Show a temporary success message
      console.log('Error details copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy error details:', err);
    });
  };

  private getSeverityColor(severity: string) {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'secondary';
    }
  }

  private getSeverityIcon(severity: string) {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'high': return <Bug className="h-4 w-4" />;
      case 'medium': return <Info className="h-4 w-4" />;
      case 'low': return <Info className="h-4 w-4" />;
      default: return <Bug className="h-4 w-4" />;
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorSeverity = this.determineErrorSeverity(this.state.error || new Error('Unknown'));
      const recentActions = this.state.userActions?.slice(-5) || [];

      // Enhanced default error UI
      return (
        <Card className="m-4 border-destructive">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-destructive flex items-center gap-2">
                🏀 Something went wrong with the NBA Analytics
                <Badge variant={this.getSeverityColor(errorSeverity)} className="flex items-center gap-1">
                  {this.getSeverityIcon(errorSeverity)}
                  {errorSeverity.toUpperCase()}
                </Badge>
              </CardTitle>
              {this.state.errorId && (
                <Badge variant="outline" className="font-mono text-xs">
                  {this.state.errorId}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error Message */}
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">Error Details:</p>
              <p className="font-mono text-xs bg-muted p-2 rounded mt-2">
                {this.state.error?.name}: {this.state.error?.message || 'Unknown error occurred'}
              </p>
            </div>

            {/* Session Info */}
            {this.state.sessionContext && (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Session Info:</p>
                <div className="bg-muted p-2 rounded mt-2 text-xs space-y-1">
                  <p>Duration: {Math.round((this.state.sessionContext.session_duration_ms as number) / 1000)}s</p>
                  <p>URL: {this.state.sessionContext.url}</p>
                  <p>Browser: {(this.state.sessionContext.user_agent as string)?.split(' ')[0]}</p>
                  <p>Online: {this.state.sessionContext.onLine ? 'Yes' : 'No'}</p>
                </div>
              </div>
            )}

            {/* Recent User Actions */}
            {recentActions.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Recent Actions:</p>
                <div className="bg-muted p-2 rounded mt-2 text-xs space-y-1">
                  {recentActions.map((action, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{action.action}</span>
                      <span>{new Date(action.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Retry Info */}
            {this.state.retryCount > 0 && (
              <div className="text-sm text-muted-foreground">
                <Badge variant="outline">
                  Retry attempts: {this.state.retryCount}
                </Badge>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={this.handleRetry} 
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button 
                onClick={this.handleReload} 
                variant="destructive"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Reload Page
              </Button>
              <Button 
                onClick={this.copyErrorDetails} 
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy Details
              </Button>
            </div>

            {/* Development Details */}
            {process.env.NODE_ENV === 'development' && (
              <div className="space-y-2">
                {this.state.errorInfo && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      Component Stack (Development)
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded overflow-auto text-xs">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
                
                {this.state.error?.stack && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      Error Stack Trace (Development)
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded overflow-auto text-xs">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}

                {this.state.sessionContext && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      Full Session Context (Development)
                    </summary>
                    <pre className="mt-2 p-2 bg-muted rounded overflow-auto text-xs">
                      {JSON.stringify(this.state.sessionContext, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
