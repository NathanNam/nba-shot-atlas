import { lazy, Suspense } from "react";

// Lazy load the navigation bar to reduce initial bundle
const NavigationBar = lazy(() => import("@/components/ui/navigation-bar").then(m => ({ default: m.NavigationBar })));

interface LazyNavigationProps {
  selectedSeason: string;
  onSeasonChange: (season: string) => void;
  viewMode: "player" | "team";
  onViewModeChange: (mode: "player" | "team") => void;
  isComparisonMode: boolean;
  onComparisonModeChange: (enabled: boolean) => void;
  selectedSeason2?: string;
  onSeason2Change?: (season: string) => void;
}

const NavigationFallback = () => (
  <nav className="bg-card border-b border-border shadow-card">
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-hero rounded-lg shadow-glow animate-pulse">
            <div className="h-6 w-6 bg-white/20 rounded"></div>
          </div>
          <div>
            <div className="h-6 w-48 bg-foreground/10 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="h-10 w-32 bg-secondary/50 rounded animate-pulse"></div>
          <div className="h-10 w-32 bg-secondary/50 rounded animate-pulse"></div>
        </div>
      </div>
    </div>
  </nav>
);

export const LazyNavigation = (props: LazyNavigationProps) => (
  <Suspense fallback={<NavigationFallback />}>
    <NavigationBar {...props} />
  </Suspense>
);