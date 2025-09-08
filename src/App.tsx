import { lazy, Suspense } from "react";

// Lazy load heavy providers  
const AppProviders = lazy(() => import("./AppProviders"));

// Lazy load pages
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Import only essential components for initial load
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <AppProviders>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppProviders>
      </Suspense>
    </BrowserRouter>
  </ErrorBoundary>
);

export default App;
