/**
 * Centralized export file for all custom hooks
 * 
 * This module exports all custom hooks for easy importing throughout the application.
 * All hooks are designed to work with OpenTelemetry instrumentation and follow
 * React best practices.
 */

// Performance monitoring hooks
export { useComponentPerformance } from './useComponentPerformance';
export type { UseComponentPerformanceReturn } from './useComponentPerformance';

// Error tracking hooks  
export { useErrorTracking } from './useErrorTracking';
export type { UseErrorTrackingReturn } from './useErrorTracking';

// NBA Analytics specific hooks
export { useNBAAnalyticsTracking, useUserActionTracking } from '../components/UserInteractionTracker';

// Existing data hooks
export { useMultiSeasonData } from './useMultiSeasonData';
export { useAvailablePlayers } from './useAvailablePlayers';
export { useBatchShotData } from './useBatchShotData';
export { useComparisonBatchShotData } from './useComparisonBatchShotData';
export { useEntityComparisonData } from './useEntityComparisonData';
export { usePlayerNames } from './usePlayerNames';
export { usePreloadedData } from './usePreloadedData';
export { useShotData } from './useShotData';
export { useSingletonShotData } from './useSingletonShotData';
export { useSupabasePlayers } from './useSupabasePlayers';
export { useSupabaseShotData } from './useSupabaseShotData';

// UI hooks
export { useMobile } from './use-mobile';
export { useToast } from './use-toast';

/**
 * Hook categories for documentation:
 * 
 * Performance & Observability:
 * - useComponentPerformance: Advanced React component performance tracking
 * - useErrorTracking: Comprehensive error handling and recovery
 * - useNBAAnalyticsTracking: NBA-specific analytics and user behavior tracking
 * - useUserActionTracking: General user interaction and session tracking
 * 
 * Data Management:
 * - useMultiSeasonData: Multi-season NBA data comparison
 * - useAvailablePlayers: Player availability by season
 * - useBatchShotData: Batch shot data processing
 * - useComparisonBatchShotData: Shot data for comparisons
 * - useEntityComparisonData: Entity comparison data management
 * - usePlayerNames: Player name resolution
 * - usePreloadedData: Data preloading management
 * - useShotData: Individual shot data
 * - useSingletonShotData: Singleton shot data pattern
 * - useSupabasePlayers: Supabase player data integration
 * - useSupabaseShotData: Supabase shot data integration
 * 
 * UI & UX:
 * - useMobile: Mobile device detection
 * - useToast: Toast notification management
 */