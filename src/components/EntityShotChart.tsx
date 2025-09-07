import { ShotChart } from "@/components/ui/shot-chart";
import { useSingletonShotData } from "@/hooks/useSingletonShotData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { useNBAAnalyticsTracking } from "@/components/UserInteractionTracker";
import { PerformanceMonitor } from "@/components/PerformanceMonitor";
import { useEffect } from "react";

interface EntityShotChartProps {
  entityName: string;
  selectedSeason: string;
  viewMode: "player" | "team" | "league";
  preloadedData?: any[]; // Optional preloaded shot data
}

export function EntityShotChart({ entityName, selectedSeason, viewMode, preloadedData }: EntityShotChartProps) {
  // Initialize NBA analytics tracking
  const { trackShotChartInteraction, trackStatisticsView } = useNBAAnalyticsTracking();
  
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
    
  // Track shot chart interaction when data is loaded
  useEffect(() => {
    if (shotData?.length > 0 && !loading && !error) {
      trackShotChartInteraction('data_loaded', {
        entity_name: cleanEntityName,
        season: selectedSeason,
        view_mode: viewMode,
        shot_count: shotData.length,
        data_source: preloadedData !== undefined ? 'preloaded' : 'api'
      });
      
      trackStatisticsView(viewMode, entityId || cleanEntityName, selectedSeason);
    }
  }, [shotData?.length, loading, error, cleanEntityName, selectedSeason, viewMode, entityId]);

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
    <PerformanceMonitor componentName={`EntityShotChart-${viewMode}-${cleanEntityName}`}>
      <ShotChart
        title={entityName}
        data={isLoading ? undefined : shotData}
        progress={isLoading ? progress : null}
      />
    </PerformanceMonitor>
  );
}