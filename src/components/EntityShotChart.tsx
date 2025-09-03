import { ShotChart } from "@/components/ui/shot-chart";
import { useShotData } from "@/hooks/useShotData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";

interface EntityShotChartProps {
  entityName: string;
  selectedSeason: string;
  viewMode: "player" | "team" | "league";
}

export function EntityShotChart({ entityName, selectedSeason, viewMode }: EntityShotChartProps) {
  const { players } = useAvailablePlayers(selectedSeason);
  
  // Convert player name to player ID for data fetching
  const getEntityId = () => {
    if (viewMode === 'player') {
      const player = players.find(p => p.name === entityName);
      return player?.id || entityName;
    }
    return entityName; // For teams, use the name directly
  };
  
  const entityId = getEntityId();
  const { shotData, loading, error } = useShotData(selectedSeason, entityId, viewMode);
  
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
      data={loading ? undefined : shotData}
    />
  );
}