import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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

// Navigation tracking component
function NavigationTracker() {
  const location = useLocation();
  const { trackNavigation } = useUserActionTracking();
  const previousPath = useRef<string>('');

  useEffect(() => {
    const currentPath = location.pathname;
    if (previousPath.current && previousPath.current !== currentPath) {
      trackNavigation(previousPath.current, currentPath, {
        search: location.search,
        hash: location.hash,
        timestamp: Date.now(),
      });
    }
    previousPath.current = currentPath;
  }, [location, trackNavigation]);

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
