import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useEffect, useRef } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { PerformanceMonitor, setupGlobalPerformanceMonitoring } from "./components/PerformanceMonitor";
import { UserInteractionTracker, useUserActionTracking } from "./components/UserInteractionTracker";

const queryClient = new QueryClient();

// Setup global performance monitoring
setupGlobalPerformanceMonitoring();

// Navigation tracking component that must be inside Router context
function NavigationTracker() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const { trackNavigation, trackAction } = useUserActionTracking();
  const previousLocation = useRef<string>('');
  const sessionStartTime = useRef<number>(Date.now());
  const routeStartTime = useRef<number>(Date.now());

  useEffect(() => {
    const currentPath = location.pathname + location.search;
    const previousPath = previousLocation.current || '/';
    
    // Track navigation event
    if (previousLocation.current) {
      const navigationTime = Date.now() - routeStartTime.current;
      
      trackNavigation(previousPath, currentPath, {
        navigation_type: navigationType,
        time_on_previous_route: navigationTime,
        search_params: location.search,
        hash: location.hash,
        session_duration: Date.now() - sessionStartTime.current,
      });
    } else {
      // Initial page load
      trackAction('session_start', {
        initial_route: currentPath,
        navigation_type: 'push',
        referrer: document.referrer || 'direct',
        user_agent: navigator.userAgent,
      });
    }

    // Update tracking state
    previousLocation.current = currentPath;
    routeStartTime.current = Date.now();
  }, [location, navigationType, trackNavigation, trackAction]);

  // Track route changes and user journey
  useEffect(() => {
    const handleBeforeUnload = () => {
      const finalRouteTime = Date.now() - routeStartTime.current;
      const totalSessionTime = Date.now() - sessionStartTime.current;
      
      trackAction('session_end', {
        final_route: location.pathname + location.search,
        time_on_final_route: finalRouteTime,
        total_session_duration: totalSessionTime,
        routes_visited: previousLocation.current ? 'multiple' : 'single',
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [location, trackAction]);

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
