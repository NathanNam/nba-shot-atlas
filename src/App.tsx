import { lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';

const Index = lazy(() => import('./pages/Index'));

const App = () => (
  <ErrorBoundary>
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <Index />
    </Suspense>
  </ErrorBoundary>
);

export default App;
