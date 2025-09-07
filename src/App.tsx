import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useEffect, useRef } from "react";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { tracer, logger, meter } from "./otel-client";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { PerformanceMonitor, setupGlobalPerformanceMonitoring } from "./components/PerformanceMonitor";
import { UserInteractionTracker } from "./components/UserInteractionTracker";
import { useComponentPerformance } from "./hooks/useComponentPerformance";
import { useErrorTracking } from "./hooks/useErrorTracking";

// Session metrics
const sessionMetrics = {
  sessionDuration: meter.createHistogram('session_duration_ms', {
    description: 'Duration of user sessions in milliseconds',
    unit: 'ms',
  }),
  routeChanges: meter.createCounter('route_changes_total', {
    description: 'Total number of route changes',
  }),
  sessionEvents: meter.createCounter('session_events_total', {
    description: 'Total number of session events (start, end, route change)',
  }),
  activeUsers: meter.createUpDownCounter('active_users', {
    description: 'Number of currently active users',
  }),
};

// Navigation tracking component
function NavigationTracker() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousRoute = useRef<string | null>(null);
  const routeStartTime = useRef<number>(Date.now());
  const sessionId = useRef<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  const errorTracker = useErrorTracking({
    source: 'NavigationTracker',
    defaultContext: {
      session_id: sessionId.current,
    }
  });

  useEffect(() => {
    const currentRoute = location.pathname + location.search;
    const startTime = Date.now();
    routeStartTime.current = startTime;

    const span = tracer.startSpan('navigation.route_change', {
      attributes: {
        'navigation.from_route': previousRoute.current || 'initial',
        'navigation.to_route': currentRoute,
        'navigation.type': navigationType,
        'navigation.session_id': sessionId.current,
        'navigation.timestamp': new Date().toISOString(),
      },
    });

    try {
      // Record route change metrics
      sessionMetrics.routeChanges.add(1, {
        from_route: previousRoute.current || 'initial',
        to_route: currentRoute,
        navigation_type: navigationType,
      });

      sessionMetrics.sessionEvents.add(1, {
        event_type: 'route_change',
        route: currentRoute,
      });

      // Log navigation event
      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'Route change detected',
        attributes: {
          from_route: previousRoute.current || 'initial',
          to_route: currentRoute,
          navigation_type: navigationType,
          session_id: sessionId.current,
          trace_id: span.spanContext().traceId,
          span_id: span.spanContext().spanId,
        },
      });

      // Track time spent on previous route
      if (previousRoute.current) {
        const timeOnRoute = startTime - routeStartTime.current;
        span.setAttributes({
          'navigation.time_on_previous_route_ms': timeOnRoute,
        });

        logger.emit({
          severityNumber: SeverityNumber.DEBUG,
          severityText: 'DEBUG',
          body: `Time spent on route: ${previousRoute.current}`,
          attributes: {
            route: previousRoute.current,
            duration_ms: timeOnRoute,
            session_id: sessionId.current,
          },
        });
      }

      previousRoute.current = currentRoute;
      span.setStatus({ code: SpanStatusCode.OK });

    } catch (error) {
      errorTracker.trackError(
        error as Error, 
        'medium', 
        { route: currentRoute, navigation_type: navigationType }
      );
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `Navigation tracking failed: ${(error as Error).message}`,
      });
    } finally {
      span.end();
    }

    // Cleanup function to track route exit time
    return () => {
      const exitTime = Date.now();
      const routeDuration = exitTime - startTime;

      logger.emit({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: `Exiting route: ${currentRoute}`,
        attributes: {
          route: currentRoute,
          duration_ms: routeDuration,
          session_id: sessionId.current,
          exit_timestamp: new Date(exitTime).toISOString(),
        },
      });
    };
  }, [location, navigationType, errorTracker]);

  return null;
}

// Session management component
function SessionManager() {
  const sessionId = useRef<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const sessionStartTime = useRef<number>(Date.now());
  const sessionSpan = useRef<any>(null);

  const errorTracker = useErrorTracking({
    source: 'SessionManager',
    defaultContext: {
      session_id: sessionId.current,
    }
  });

  useEffect(() => {
    // Start session span
    sessionSpan.current = tracer.startSpan('session.user_session', {
      attributes: {
        'session.id': sessionId.current,
        'session.start_time': new Date().toISOString(),
        'session.user_agent': navigator.userAgent,
        'session.url': window.location.href,
        'session.referrer': document.referrer || 'direct',
      },
    });

    // Record session start
    sessionMetrics.sessionEvents.add(1, {
      event_type: 'session_start',
      session_id: sessionId.current,
    });

    sessionMetrics.activeUsers.add(1);

    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'User session started',
      attributes: {
        session_id: sessionId.current,
        user_agent: navigator.userAgent,
        initial_url: window.location.href,
        referrer: document.referrer || 'direct',
        timestamp: new Date().toISOString(),
        trace_id: sessionSpan.current.spanContext().traceId,
        span_id: sessionSpan.current.spanContext().spanId,
      },
    });

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      const event = document.hidden ? 'session_hidden' : 'session_visible';
      
      sessionMetrics.sessionEvents.add(1, {
        event_type: event,
        session_id: sessionId.current,
      });

      logger.emit({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: `Session visibility changed: ${event}`,
        attributes: {
          session_id: sessionId.current,
          visibility_state: document.visibilityState,
          timestamp: new Date().toISOString(),
        },
      });

      sessionSpan.current?.addEvent(event, {
        'session.visibility_state': document.visibilityState,
        'session.timestamp': new Date().toISOString(),
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle beforeunload for session end tracking
    const handleBeforeUnload = () => {
      const sessionDuration = Date.now() - sessionStartTime.current;
      
      sessionMetrics.sessionDuration.record(sessionDuration, {
        session_id: sessionId.current,
      });

      sessionMetrics.sessionEvents.add(1, {
        event_type: 'session_end',
        session_id: sessionId.current,
      });

      sessionMetrics.activeUsers.add(-1);

      // Note: beforeunload has limited capability for async operations
      logger.emit({
        severityNumber: SeverityNumber.INFO,
        severityText: 'INFO',
        body: 'User session ending',
        attributes: {
          session_id: sessionId.current,
          session_duration_ms: sessionDuration,
          end_timestamp: new Date().toISOString(),
        },
      });

      if (sessionSpan.current) {
        sessionSpan.current.setAttributes({
          'session.duration_ms': sessionDuration,
          'session.end_time': new Date().toISOString(),
        });
        sessionSpan.current.setStatus({ code: SpanStatusCode.OK });
        sessionSpan.current.end();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Handle component unmount (different from page unload)
      const sessionDuration = Date.now() - sessionStartTime.current;
      
      logger.emit({
        severityNumber: SeverityNumber.DEBUG,
        severityText: 'DEBUG',
        body: 'Session manager component unmounted',
        attributes: {
          session_id: sessionId.current,
          session_duration_ms: sessionDuration,
        },
      });

      if (sessionSpan.current) {
        sessionSpan.current.setAttributes({
          'session.duration_ms': sessionDuration,
          'session.unmount_time': new Date().toISOString(),
        });
        sessionSpan.current.setStatus({ code: SpanStatusCode.OK });
        sessionSpan.current.end();
      }
    };
  }, [errorTracker]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Log query failures for observability
        logger.emit({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
          body: `React Query retry attempt ${failureCount}`,
          attributes: {
            failure_count: failureCount,
            error_message: (error as Error).message,
            will_retry: failureCount < 3,
          },
        });
        return failureCount < 3;
      },
      onError: (error) => {
        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: 'ERROR',
          body: 'React Query error',
          attributes: {
            error_message: (error as Error).message,
            error_name: (error as Error).name,
          },
        });
      },
    },
  },
});

// Setup global performance monitoring
setupGlobalPerformanceMonitoring();

const AppContent = () => {
  const componentPerf = useComponentPerformance({
    componentName: 'App',
    metadata: {
      initial_url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    }
  });

  return (
    <ErrorBoundary>
      <UserInteractionTracker>
        <PerformanceMonitor componentName="App">
          <SessionManager />
          <NavigationTracker />
          <QueryClientProvider client={queryClient}>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem
              disableTransitionOnChange
            >
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <Routes>
                  <Route path="/" element={<Index />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </TooltipProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </PerformanceMonitor>
      </UserInteractionTracker>
    </ErrorBoundary>
  );
};

const App = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default App;
