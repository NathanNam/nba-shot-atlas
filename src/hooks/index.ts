// OpenTelemetry Enhanced Hooks
export { useErrorTracking } from './useErrorTracking';
export { useComponentPerformance } from './useComponentPerformance';
export { useCoreWebVitals } from './useCoreWebVitals';

// User interaction and analytics hooks (already existing)
export { useUserActionTracking, useNBAAnalyticsTracking } from '../components/UserInteractionTracker';

// Data hooks (existing)
export { useAvailablePlayers } from './useAvailablePlayers';
export { useBatchShotData } from './useBatchShotData';
export { useComparisonBatchShotData } from './useComparisonBatchShotData';
export { useEntityComparisonData } from './useEntityComparisonData';
export { useMultiSeasonData } from './useMultiSeasonData';
export { usePlayerNames } from './usePlayerNames';
export { usePreloadedData } from './usePreloadedData';
export { useShotData } from './useShotData';
export { useSingletonShotData } from './useSingletonShotData';
export { useSupabasePlayers } from './useSupabasePlayers';
export { useSupabaseShotData } from './useSupabaseShotData';

// UI hooks (existing)
export { useMobile } from './use-mobile';
export { useToast } from './use-toast';

// Type definitions for enhanced hooks
export interface PerformanceConfig {
  slowRenderThreshold?: number;
  memoryLeakThreshold?: number;
  trackUpdates?: boolean;
  trackMemory?: boolean;
}

export interface ErrorContext {
  componentName?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  additionalContext?: Record<string, any>;
}

export interface ErrorInfo {
  message: string;
  stack?: string;
  name?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface WebVitalsMetrics {
  cls?: number;
  fid?: number;
  lcp?: number;
  fcp?: number;
  ttfb?: number;
}

export interface PerformanceMetrics {
  renderTime: number;
  mountTime: number;
  updateCount: number;
  memoryUsage?: number;
  isSlowRender: boolean;
}