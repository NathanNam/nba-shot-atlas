import { ShotChart } from "@/components/ui/shot-chart";
import { useSupabaseShotData } from "@/hooks/useSupabaseShotData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";

interface EntityShotChartProps {
  entityName: string;
  selectedSeason: string;
  viewMode: "player" | "team" | "league";
}

export function EntityShotChart({ entityName, selectedSeason, viewMode }: EntityShotChartProps) {
  const { players, loading: playersLoading } = useAvailablePlayers(selectedSeason);
  
  // Convert player name to player ID for data fetching
  const getEntityId = () => {
    if (viewMode === 'player') {
      if (playersLoading) {
        // For default player (Stephen Curry), return the known ID immediately
        if (entityName === 'Stephen Curry') {
          return '201939';
        }
        // For other players, return undefined while loading
        return undefined;
      }
      const player = players.find(p => p.name === entityName);
      console.log(`🔍 EntityShotChart: Looking for "${entityName}", found player:`, player);
      return player?.id || undefined; // Return undefined instead of entityName to prevent invalid IDs
    }
    return entityName; // For teams, use the name directly
  };
  
  const entityId = getEntityId();
  
  console.log(`🔍 EntityShotChart: Final entityId for "${entityName}":`, entityId, 'playersLoading:', playersLoading);
  
  // Always pass the correct entityId to the hook, let the hook handle loading logic
  const { shotData, loading, error } = useSupabaseShotData(
    selectedSeason, 
    entityId || '', 
    viewMode
  );
  
  console.log(`🔍 EntityShotChart DEBUG - ${entityName}:`, {
    entityId,
    shotDataLength: shotData.length,
    loading,
    error,
    playersLoading
  });
  
  // Show loading while players are loading or while shot data is loading  
  const isLoading = playersLoading || loading || !entityId;
  
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
    <ShotChart
      title={entityName}
      data={isLoading ? undefined : shotData}
    />
  );
}