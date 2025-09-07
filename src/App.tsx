import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useEffect } from 'react';
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { PerformanceMonitor, setupGlobalPerformanceMonitoring } from "./components/PerformanceMonitor";
import { UserInteractionTracker } from "./components/UserInteractionTracker";
import { useComponentPerformance } from "./hooks/useComponentPerformance";
import { useErrorTracking } from "./hooks/useErrorTracking";
import { SeverityNumber } from '@opentelemetry/api-logs';
import { logger, meter } from './otel-client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Add error tracking for queries
      onError: (error: any) => {
        logger.emit({
          severityNumber: SeverityNumber.ERROR,
          severityText: 'ERROR',
          body: 'React Query error',
          attributes: {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
          },
        });
      },
    },
  },
});

// Navigation tracking metrics
const navigationCounter = meter.createCounter('app_navigation_events_total', {
  description: 'Total number of navigation events in the app',
});

// Enhanced App component with comprehensive tracking
function AppContent() {
  const {
    isPerformingPoorly,
    averageRenderTime,
    getMetrics,
  } = useComponentPerformance({
    componentName: 'App',
    trackMemory: true,
    slowRenderThreshold: 200,
    enableDetailedTracking: true,
  });

  const { trackError } = useErrorTracking({
    autoCapture: true,
    enableRecovery: true,
    maxRecoveryAttempts: 3,
  });

  // Monitor app-level performance
  useEffect(() => {
    if (isPerformingPoorly) {
      trackError(new Error('App performance degradation detected'), {
        component: 'App',
        function: 'performance_monitor',
        customContext: {
          averageRenderTime,
          performanceMetrics: getMetrics(),
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        },
      });
    }
  }, [isPerformingPoorly, averageRenderTime, getMetrics, trackError]);

  return (
    <ErrorBoundary>
      <UserInteractionTracker>
        <PerformanceMonitor componentName="App">
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
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </PerformanceMonitor>
      </UserInteractionTracker>
    </ErrorBoundary>
  );
}

// Setup global performance monitoring
setupGlobalPerformanceMonitoring();

const App = () => <AppContent />;

export default App;
