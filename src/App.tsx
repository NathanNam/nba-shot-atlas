import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
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
