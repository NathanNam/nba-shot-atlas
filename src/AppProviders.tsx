import { Suspense, lazy, ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";

// Lazy load heavy providers and components
const QueryClientProvider = lazy(() => import("@tanstack/react-query").then(m => ({ default: m.QueryClientProvider })));
const ThemeProvider = lazy(() => import("next-themes").then(m => ({ default: m.ThemeProvider })));
const TooltipProvider = lazy(() => import("@/components/ui/tooltip").then(m => ({ default: m.TooltipProvider })));
const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const Sonner = lazy(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));
const PerformanceMonitor = lazy(() => import("./components/PerformanceMonitor").then(m => ({ default: m.PerformanceMonitor })));
const UserInteractionTracker = lazy(() => import("./components/UserInteractionTracker").then(m => ({ default: m.UserInteractionTracker })));

// Create queryClient instance
const queryClient = new QueryClient();

// Setup performance monitoring lazily
const setupPerformanceMonitoring = async () => {
  const { setupGlobalPerformanceMonitoring } = await import("./components/PerformanceMonitor");
  setupGlobalPerformanceMonitoring();
};

interface AppProvidersProps {
  children: ReactNode;
}

const ProviderFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
  </div>
);

const AppProviders = ({ children }: AppProvidersProps) => {
  // Setup performance monitoring asynchronously
  setTimeout(() => {
    setupPerformanceMonitoring().catch(console.error);
  }, 0);

  return (
    <Suspense fallback={<ProviderFallback />}>
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
                {children}
              </TooltipProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </PerformanceMonitor>
      </UserInteractionTracker>
    </Suspense>
  );
};

export default AppProviders;