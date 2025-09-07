import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { PerformanceMonitor, setupGlobalPerformanceMonitoring } from "./components/PerformanceMonitor";
import { UserInteractionTracker, useUserActionTracking } from "./components/UserInteractionTracker";
import { useCoreWebVitals } from "./hooks";
import { NBAAnalyticsMetrics } from "./services/nbaAnalyticsMetrics";

const queryClient = new QueryClient();

// Setup global performance monitoring
setupGlobalPerformanceMonitoring();

// Navigation tracking component
function NavigationTracker() {
  const location = useLocation();
  const { trackNavigation } = useUserActionTracking();
  const [previousLocation, setPreviousLocation] = useState<string>('/');

  useEffect(() => {
    if (location.pathname !== previousLocation) {
      trackNavigation(previousLocation, location.pathname, {
        search: location.search,
        hash: location.hash,
      });
      setPreviousLocation(location.pathname);
    }
  }, [location, previousLocation, trackNavigation]);

  return null;
}

// Session management component
function SessionManager() {
  const { metrics: webVitalsMetrics } = useCoreWebVitals();

  useEffect(() => {
    // Track session start with enhanced context
    const sessionStartTime = Date.now();
    const sessionId = `nba-session-${sessionStartTime}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session info in sessionStorage for cross-component access
    sessionStorage.setItem('nba_session_id', sessionId);
    sessionStorage.setItem('nba_session_start', sessionStartTime.toString());

    // Track application lifecycle events
    const handleVisibilityChange = () => {
      if (document.hidden) {
        NBAAnalyticsMetrics.trackFeatureUsage('app_backgrounded', {
          session_id: sessionId,
          time_in_foreground: Date.now() - sessionStartTime,
        });
      } else {
        NBAAnalyticsMetrics.trackFeatureUsage('app_foregrounded', {
          session_id: sessionId,
        });
      }
    };

    const handleBeforeUnload = () => {
      const sessionDuration = Date.now() - sessionStartTime;
      NBAAnalyticsMetrics.trackFeatureUsage('session_ended', {
        session_id: sessionId,
        session_duration: sessionDuration,
        web_vitals: webVitalsMetrics,
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [webVitalsMetrics]);

  return null;
}

const App = () => (
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
                <NavigationTracker />
                <SessionManager />
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

export default App;
