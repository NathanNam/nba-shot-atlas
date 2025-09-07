import { useEffect, useRef } from "react";
import { ShotChart } from "@/components/ui/shot-chart";
import { useSingletonShotData } from "@/hooks/useSingletonShotData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { useNBAAnalyticsTracking } from "@/components/UserInteractionTracker";
import { PerformanceMonitor, trackDataLoading } from "@/components/PerformanceMonitor";

interface EntityShotChartProps {
  entityName: string;
  selectedSeason: string;
  viewMode: "player" | "team" | "league";
  preloadedData?: any[]; // Optional preloaded shot data
}

export function EntityShotChart({ entityName, selectedSeason, viewMode, preloadedData }: EntityShotChartProps) {
  const { trackShotChartInteraction, trackPlayerSelection, trackTeamSelection, trackStatisticsView } = useNBAAnalyticsTracking();
  
  // Always call hook but only use results in player mode
  const { players: rawPlayers, loading: rawLoading } = useAvailablePlayers();
  
  // Only use player data in player mode
  const players = viewMode === "player" ? rawPlayers : [];
  const playersLoading = viewMode === "player" ? rawLoading : false;
  
  // Extract clean entity name from display name (remove season info if present)
  const cleanEntityName = entityName.includes(' (') ? entityName.split(' (')[0] : entityName;
  
  // Convert player name to player ID for data fetching
  const getEntityId = () => {
    if (viewMode === 'player') {
      if (playersLoading) {
        // For default player (Stephen Curry), return the known ID immediately
        if (cleanEntityName === 'Stephen Curry') {
          return '201939';
        }
        // For other players, return undefined while loading
        return undefined;
      }
      const player = players.find(p => p.name === cleanEntityName);
      console.log(`🔍 EntityShotChart: Looking for "${cleanEntityName}", found player:`, player);
      return player?.id || undefined; // Return undefined instead of entityName to prevent invalid IDs
    }
    return cleanEntityName; // For teams/league, use the name directly
  };
  
  const entityId = getEntityId();
  
  console.log(`🔍 EntityShotChart: Final entityId for "${cleanEntityName}" (display: "${entityName}"):`, entityId, 'playersLoading:', playersLoading);
  
  // Always call the hook (rules of hooks), but use preloaded data if available
  const hookResult = useSingletonShotData(
    selectedSeason,
    entityId || '201939', // Use Stephen Curry's ID as fallback for default case
    viewMode,
    preloadedData === undefined
  );
  
  // Use preloaded data if available, otherwise use hook result
  const { shotData, loading, error, progress } = preloadedData !== undefined
    ? { shotData: preloadedData, loading: false, error: null, progress: null }
    : hookResult;

  // Track data loading performance
  const startTimeRef = useRef<number | null>(preloadedData !== undefined ? Date.now() : null);
  const hasTrackedRef = useRef(false);

  // Reset timer when preloaded data changes
  useEffect(() => {
    if (preloadedData !== undefined) {
      startTimeRef.current = Date.now();
      hasTrackedRef.current = false;
    }
  }, [preloadedData]);

  useEffect(() => {
    if (loading && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
      hasTrackedRef.current = false;
      return;
    }

    if (!loading && shotData && shotData.length > 0 && !hasTrackedRef.current) {
      const loadDuration = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
      const isPreloaded = preloadedData !== undefined;

      trackDataLoading(
        `shot_chart_${viewMode}_${cleanEntityName}`,
        loadDuration,
        isPreloaded,
        shotData.length
      );

      // Track entity selection
      if (viewMode === 'player') {
        trackPlayerSelection(entityId || 'unknown', cleanEntityName, selectedSeason);
      } else if (viewMode === 'team') {
        trackTeamSelection(entityId || 'unknown', cleanEntityName, selectedSeason);
      }

      trackStatisticsView(viewMode, entityId || 'unknown', selectedSeason);

      hasTrackedRef.current = true;
      startTimeRef.current = null;
    }
  }, [loading, shotData, viewMode, entityId, cleanEntityName, selectedSeason, preloadedData, trackPlayerSelection, trackTeamSelection, trackStatisticsView]);

  // Track shot chart interactions
  useEffect(() => {
    if (shotData && shotData.length > 0) {
      trackShotChartInteraction('chart_rendered', {
        entity_name: cleanEntityName,
        entity_type: viewMode,
        season: selectedSeason,
        shots_count: shotData.length,
        data_source: preloadedData !== undefined ? 'preloaded' : 'api',
      });
    }
  }, [shotData, cleanEntityName, viewMode, selectedSeason, preloadedData]);
    
  // Debug logging
  console.log(`🔍 EntityShotChart [${cleanEntityName}]: Using ${preloadedData !== undefined ? 'preloaded' : 'hook'} data`, {
    preloadedLength: preloadedData?.length,
    hookLength: hookResult.shotData?.length,
    finalLength: shotData?.length,
    loading,
    error
  });
  
  console.log(`🔍 EntityShotChart DEBUG - ${entityName}:`, {
    entityId,
    shotDataLength: shotData.length,
    loading,
    error,
    playersLoading
  });
  
  // Show loading while players are loading (only in player mode) or while shot data is loading  
  const isLoading = (viewMode === 'player' && playersLoading) || loading || !entityId;
  
  if (error) {
    return (
      <div className="p-6 bg-card border-border shadow-card rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-4 text-center">{entityName}</h3>
        <p className="text-destructive text-center">Error loading data: {error}</p>
      </div>
    );
  }
  
  console.log(`🔍 EntityShotChart RENDER - ${entityName}:`, {
    isLoading,
    shotDataWillBePassedToChart: !isLoading ? shotData.length : 'LOADING'
  });
  
  return (
    <PerformanceMonitor componentName={`EntityShotChart-${viewMode}`}>
      <ShotChart
        title={entityName}
        data={isLoading ? undefined : shotData}
        progress={isLoading ? progress : null}
      />
    </PerformanceMonitor>
  );
}
