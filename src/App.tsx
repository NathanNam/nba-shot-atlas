import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";

// Lazy load pages to reduce initial bundle size
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
import ErrorBoundary from "./components/ErrorBoundary";
import { PerformanceMonitor, setupGlobalPerformanceMonitoring } from "./components/PerformanceMonitor";
import { UserInteractionTracker } from "./components/UserInteractionTracker";

const queryClient = new QueryClient();

// Setup global performance monitoring
setupGlobalPerformanceMonitoring();

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
                <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div></div>}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </PerformanceMonitor>
    </UserInteractionTracker>
  </ErrorBoundary>
);

export default App;
