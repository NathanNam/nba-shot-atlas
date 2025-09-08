import { lazy, Suspense } from "react";

// Lazy load heavy components to reduce initial bundle
const EntityShotChart = lazy(() => import("@/components/EntityShotChart").then(m => ({ default: m.EntityShotChart })));
const EntityStatistics = lazy(() => import("@/components/EntityStatistics").then(m => ({ default: m.EntityStatistics })));
const ComparisonShotChart = lazy(() => import("@/components/ComparisonShotChart").then(m => ({ default: m.ComparisonShotChart })));
const ComparisonStatistics = lazy(() => import("@/components/ComparisonStatistics").then(m => ({ default: m.ComparisonStatistics })));
const BatchEntityLayout = lazy(() => import("@/components/BatchEntityLayout").then(m => ({ default: m.BatchEntityLayout })));
const EntityVsEntityComparison = lazy(() => import("@/components/EntityVsEntityComparison").then(m => ({ default: m.EntityVsEntityComparison })));

interface LazyComponentProps {
  component: 'EntityShotChart' | 'EntityStatistics' | 'ComparisonShotChart' | 'ComparisonStatistics' | 'BatchEntityLayout' | 'EntityVsEntityComparison';
  [key: string]: any;
}

const ComponentLoader = ({ component, ...props }: LazyComponentProps) => {
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
    </div>
  );

  const renderComponent = () => {
    switch (component) {
      case 'EntityShotChart':
        return <EntityShotChart {...props as any} />;
      case 'EntityStatistics':
        return <EntityStatistics {...props as any} />;
      case 'ComparisonShotChart':
        return <ComparisonShotChart {...props as any} />;
      case 'ComparisonStatistics':
        return <ComparisonStatistics {...props as any} />;
      case 'BatchEntityLayout':
        return <BatchEntityLayout {...props as any} />;
      case 'EntityVsEntityComparison':
        return <EntityVsEntityComparison {...props as any} />;
      default:
        return <div>Component not found</div>;
    }
  };

  return (
    <Suspense fallback={<LoadingSpinner />}>
      {renderComponent()}
    </Suspense>
  );
};

export { ComponentLoader };