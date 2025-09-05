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
        // Return undefined while loading to prevent data fetching with incorrect ID
        return undefined;
      }
      const player = players.find(p => p.name === entityName);
      console.log(`🔍 EntityShotChart: Looking for "${entityName}", found player:`, player);
      return player?.id || entityName;
    }
    return entityName; // For teams, use the name directly
  };
  
  const entityId = getEntityId();
  
  console.log(`🔍 EntityShotChart: Final entityId for "${entityName}":`, entityId, 'playersLoading:', playersLoading);
  
  // Only fetch shot data if we have a valid entityId and players are not loading
  const shouldFetchData = !playersLoading && entityId !== undefined;
  const { shotData, loading, error } = useSupabaseShotData(
    selectedSeason, 
    shouldFetchData ? entityId : '', 
    viewMode
  );
  
  // Show loading while players are loading or while shot data is loading
  const isLoading = playersLoading || loading || !shouldFetchData;
  
  if (error) {
    return (
      <div className="p-6 bg-card border-border shadow-card rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-4 text-center">{entityName}</h3>
        <p className="text-destructive text-center">Error loading data: {error}</p>
      </div>
    );
  }
  
  return (
    <ShotChart
      title={entityName}
      data={isLoading ? undefined : shotData}
    />
  );
}