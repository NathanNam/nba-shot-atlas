import React, { Component, ErrorInfo, ReactNode } from 'react';
import { trace, SpanStatusCode, context } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { tracer, logger, meter } from '../otel-client';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertTriangle, RefreshCw, RotateCcw, Bug, User, Clock, Globe } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  enableRecovery?: boolean;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  sessionContext?: {
    sessionId: string;
    userId?: string;
    sessionDuration: number;
    userAgent: string;
    viewport: string;
    url: string;
    timestamp: string;
  };
  componentStack?: {
    depth: number;
    componentNames: string[];
    renderStack: string[];
  };
  retryCount: number;
  lastErrorTime?: number;
}

// Enhanced metrics for error tracking
const errorCounter = meter.createCounter('react_errors_total', {
  description: 'Total number of React errors caught by error boundary',
});

const errorRecoveryCounter = meter.createCounter('react_error_recoveries_total', {
  description: 'Total number of error boundary recoveries',
});

const errorDurationHistogram = meter.createHistogram('error_boundary_duration_ms', {
  description: 'Time between error occurrence and user recovery action',
  unit: 'ms',
});

const errorTypeCounter = meter.createCounter('react_error_types_total', {
  description: 'Count of different types of React errors',
});

const userSessionErrorCounter = meter.createCounter('user_session_errors_total', {
  description: 'Errors per user session context',
});

class ErrorBoundary extends Component<Props, State> {
  private sessionStartTime: number;
  private errorOccurrenceTime?: number;

  constructor(props: Props) {
    super(props);
    this.sessionStartTime = Date.now();
    this.state = {
      hasError: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    // Capture session context
    const sessionContext = {
      sessionId: sessionStorage.getItem('sessionId') || 'unknown',
      userId: sessionStorage.getItem('userId') || undefined,
      sessionDuration: Date.now() - parseInt(sessionStorage.getItem('sessionStartTime') || '0'),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      timestamp,
    };

    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId,
      sessionContext,
      lastErrorTime: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.errorOccurrenceTime = Date.now();
    const errorId = this.state.errorId || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Enhanced component stack analysis
    const componentStack = this.analyzeComponentStack(errorInfo.componentStack);
    
    const span = tracer.startSpan('error_boundary.component_error', {
      attributes: {
        'error.type': 'react_component_error',
        'error.id': errorId,
        'error.name': error.name,
        'error.message': error.message,
        'error.stack': error.stack || 'No stack trace available',
        'error.component_stack': errorInfo.componentStack,
        'error.component_depth': componentStack.depth,
        'error.session_id': this.state.sessionContext?.sessionId || 'unknown',
        'error.session_duration_ms': this.state.sessionContext?.sessionDuration || 0,
        'error.retry_count': this.state.retryCount,
      },
    });

    try {
      // Record enhanced error metrics
      errorCounter.add(1, {
        error_name: error.name,
        error_type: 'component_error',
        component_depth: componentStack.depth.toString(),
        has_session_context: this.state.sessionContext ? 'true' : 'false',
        retry_count: this.state.retryCount.toString(),
      });

      errorTypeCounter.add(1, {
        error_type: error.name,
        error_category: this.categorizeError(error),
      });

      if (this.state.sessionContext) {
        userSessionErrorCounter.add(1, {
          session_id: this.state.sessionContext.sessionId,
          session_age: this.state.sessionContext.sessionDuration > 300000 ? 'long' : 'short',
          viewport_category: this.categorizeViewport(this.state.sessionContext.viewport),
        });
      }

      // Log comprehensive error information
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: 'ERROR',
        body: 'React component error caught by error boundary',
        attributes: {
          error_id: errorId,
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
          error_category: this.categorizeError(error),
          component_stack: errorInfo.componentStack,
          component_depth: componentStack.depth,
          component_names: JSON.stringify(componentStack.componentNames),
          render_stack: JSON.stringify(componentStack.renderStack),
          session_context: JSON.stringify(this.state.sessionContext),
          retry_count: this.state.retryCount,
          error_occurrence_time: this.errorOccurrenceTime,
          session_duration_at_error: Date.now() - this.sessionStartTime,
          user_agent: this.state.sessionContext?.userAgent || 'unknown',
          viewport: this.state.sessionContext?.viewport || 'unknown',
          url: this.state.sessionContext?.url || 'unknown',
          timestamp: new Date().toISOString(),
        },
      });

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `React error: ${error.message}`,
      });

      // Store enhanced error info in state for display
      this.setState({
        errorInfo,
        componentStack,
        errorId,
      });

      // Call custom error handler if provided
      if (this.props.onError) {
        try {
          this.props.onError(error, errorInfo);
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

      // Log to console for development
      console.error('Error Boundary caught an error:', error, errorInfo);
    } finally {
      span.end();
    }
  }

  handleRetry = () => {
    const retryDuration = this.errorOccurrenceTime ? Date.now() - this.errorOccurrenceTime : 0;
    const newRetryCount = this.state.retryCount + 1;
    
    const span = tracer.startSpan('error_boundary.retry', {
      attributes: {
        'error.recovery_action': 'user_retry',
        'error.id': this.state.errorId || 'unknown',
        'error.retry_count': newRetryCount,
        'error.retry_duration_ms': retryDuration,
        'error.session_id': this.state.sessionContext?.sessionId || 'unknown',
      },
    });

    try {
      errorRecoveryCounter.add(1, {
        recovery_type: 'user_retry',
        retry_count: newRetryCount.toString(),
        error_type: this.state.error?.name || 'unknown',
      });

      if (retryDuration > 0) {
        errorDurationHistogram.record(retryDuration, {
          recovery_action: 'retry',
          error_type: this.state.error?.name || 'unknown',
          retry_count: newRetryCount.toString(),
        });
      }

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'User initiated error boundary retry',
        attributes: {
          error_id: this.state.errorId || 'unknown',
          previous_error: this.state.error?.message || 'Unknown error',
          retry_count: newRetryCount,
          retry_duration_ms: retryDuration,
          session_id: this.state.sessionContext?.sessionId,
          url: this.state.sessionContext?.url || window.location.href,
          timestamp: new Date().toISOString(),
        },
      });

      // Reset error state with updated retry count
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        errorId: undefined,
        componentStack: undefined,
        retryCount: newRetryCount,
        lastErrorTime: undefined,
      });
      
      this.errorOccurrenceTime = undefined;
    } finally {
      span.end();
    }
  };

  handleReload = () => {
    const reloadDuration = this.errorOccurrenceTime ? Date.now() - this.errorOccurrenceTime : 0;
    
    const span = tracer.startSpan('error_boundary.reload', {
      attributes: {
        'error.recovery_action': 'page_reload',
        'error.id': this.state.errorId || 'unknown',
        'error.retry_count': this.state.retryCount,
        'error.reload_duration_ms': reloadDuration,
        'error.session_id': this.state.sessionContext?.sessionId || 'unknown',
      },
    });

    try {
      errorRecoveryCounter.add(1, {
        recovery_type: 'page_reload',
        retry_count: this.state.retryCount.toString(),
        error_type: this.state.error?.name || 'unknown',
      });

      if (reloadDuration > 0) {
        errorDurationHistogram.record(reloadDuration, {
          recovery_action: 'reload',
          error_type: this.state.error?.name || 'unknown',
        });
      }

      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'User initiated page reload from error boundary',
        attributes: {
          error_id: this.state.errorId || 'unknown',
          previous_error: this.state.error?.message || 'Unknown error',
          retry_count: this.state.retryCount,
          reload_duration_ms: reloadDuration,
          session_id: this.state.sessionContext?.sessionId,
          url: this.state.sessionContext?.url || window.location.href,
          timestamp: new Date().toISOString(),
        },
      });

      window.location.reload();
    } finally {
      span.end();
    }
  };

  // Helper methods for error analysis
  private analyzeComponentStack(componentStack: string) {
    const lines = componentStack.split('\n').filter(line => line.trim());
    const componentNames = lines
      .map(line => {
        const match = line.match(/in (\w+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];
    
    return {
      depth: lines.length,
      componentNames: componentNames.slice(0, 10), // Top 10 components
      renderStack: lines.slice(0, 5), // Top 5 stack entries
    };
  }

  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('permission') || message.includes('auth')) return 'authorization';
    if (message.includes('render') || stack.includes('render')) return 'rendering';
    if (message.includes('hook') || stack.includes('hook')) return 'hooks';
    if (message.includes('state') || message.includes('props')) return 'state_management';
    if (message.includes('async') || message.includes('promise')) return 'async';
    if (message.includes('memory') || message.includes('heap')) return 'memory';
    
    return 'unknown';
  }

  private categorizeViewport(viewport: string): string {
    const [width] = viewport.split('x').map(Number);
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const showDetails = this.props.showDetails ?? (process.env.NODE_ENV === 'development');
      const enableRecovery = this.props.enableRecovery ?? true;

      // Enhanced error UI with comprehensive context
      return (
        <Card className="m-4 border-destructive max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              🏀 NBA Analytics Error
            </CardTitle>
            <div className="flex gap-2 mt-2">
              <Badge variant="destructive">
                {this.categorizeError(this.state.error!)}
              </Badge>
              <Badge variant="outline">
                Retry #{this.state.retryCount}
              </Badge>
              {this.state.errorId && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {this.state.errorId.slice(-8)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Error Message */}
            <div className="text-sm text-muted-foreground">
              <p className="font-medium flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Error Details:
              </p>
              <p className="font-mono text-xs bg-muted p-3 rounded mt-2 border">
                {this.state.error?.message || 'Unknown error occurred'}
              </p>
            </div>

            {/* Session Context */}
            {this.state.sessionContext && showDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Session Info
                  </h4>
                  <div className="space-y-1 text-muted-foreground">
                    <p>ID: <span className="font-mono">{this.state.sessionContext.sessionId}</span></p>
                    <p>Duration: {Math.round(this.state.sessionContext.sessionDuration / 1000)}s</p>
                    <p>Viewport: {this.state.sessionContext.viewport}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Environment
                  </h4>
                  <div className="space-y-1 text-muted-foreground">
                    <p>URL: <span className="font-mono text-xs break-all">{this.state.sessionContext.url}</span></p>
                    <p className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(this.state.sessionContext.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Component Stack Analysis */}
            {this.state.componentStack && showDetails && (
              <div className="text-sm">
                <h4 className="font-medium mb-2">Component Analysis:</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-muted-foreground">Stack Depth: <span className="font-semibold">{this.state.componentStack.depth}</span></p>
                    <p className="text-muted-foreground mt-1">Components:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {this.state.componentStack.componentNames.slice(0, 5).map((name, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{name}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Recovery Actions */}
            {enableRecovery && (
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={this.handleRetry} variant="outline" className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button onClick={this.handleReload} variant="destructive" className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Reload Page
                </Button>
              </div>
            )}

            {/* Development Details */}
            {showDetails && this.state.errorInfo && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Technical Details (Development)
                </summary>
                <div className="mt-3 space-y-3">
                  <div>
                    <h5 className="font-medium mb-1">Stack Trace:</h5>
                    <pre className="p-3 bg-muted rounded overflow-auto text-xs border font-mono">
                      {this.state.error?.stack || 'No stack trace available'}
                    </pre>
                  </div>
                  <div>
                    <h5 className="font-medium mb-1">Component Stack:</h5>
                    <pre className="p-3 bg-muted rounded overflow-auto text-xs border font-mono">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                </div>
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

// Export enhanced ErrorBoundary with default props
export const EnhancedErrorBoundary: React.FC<{
  children: ReactNode;
  showDetails?: boolean;
  enableRecovery?: boolean;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}> = ({ children, showDetails = false, enableRecovery = true, onError }) => {
  return (
    <ErrorBoundary
      showDetails={showDetails}
      enableRecovery={enableRecovery}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  );
};
