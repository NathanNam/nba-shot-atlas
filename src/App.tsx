import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { PerformanceMonitor, setupGlobalPerformanceMonitoring } from "./components/PerformanceMonitor";
import { UserInteractionTracker } from "./components/UserInteractionTracker";
import { useUserActionTracking } from "./hooks/useUserActionTracking";
import { useComponentPerformance } from "./hooks/useComponentPerformance";

const queryClient = new QueryClient();

// Setup global performance monitoring
setupGlobalPerformanceMonitoring();

// Navigation tracking component
const NavigationTracker = () => {
  const location = useLocation();
  const { trackRouteChange, trackMilestone } = useUserActionTracking();
  const { trackComponentError } = useComponentPerformance('NavigationTracker');
  
  useEffect(() => {
    try {
      // Track route changes
      trackRouteChange(location.pathname, undefined, undefined, undefined);
      
      // Track specific milestones based on routes
      if (location.pathname === '/') {
        trackMilestone('home_page_visit');
      } else if (location.pathname === '/404' || location.pathname === '*') {
        trackMilestone('not_found_page_visit', { original_path: location.pathname });
      }
    } catch (error) {
      trackComponentError(error as Error, { navigation: true });
    }
  }, [location.pathname, trackRouteChange, trackMilestone, trackComponentError]);
  
  return null;
};

// Application lifecycle tracker
const AppLifecycleTracker = () => {
  const { trackMilestone } = useUserActionTracking();
  const { trackComponentError } = useComponentPerformance('AppLifecycleTracker');
  
  useEffect(() => {
    try {
      // Track application start
      trackMilestone('app_start', {
        timestamp: Date.now(),
        user_agent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        theme: localStorage.getItem('theme') || 'system',
      });
      
      // Track page visibility changes
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          trackMilestone('app_background');
        } else {
          trackMilestone('app_foreground');
        }
      };
      
      // Track window focus/blur for engagement tracking
      const handleFocus = () => trackMilestone('app_focus');
      const handleBlur = () => trackMilestone('app_blur');
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
        trackMilestone('app_cleanup');
      };
    } catch (error) {
      trackComponentError(error as Error, { lifecycle: true });
    }
  }, [trackMilestone, trackComponentError]);
  
  return null;
};

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
                <AppLifecycleTracker />
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
