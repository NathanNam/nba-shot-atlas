import { ShotChart } from "@/components/ui/shot-chart";
import { useMultiSeasonData } from "@/hooks/useMultiSeasonData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { Card } from "@/components/ui/card";

interface ComparisonShotChartProps {
  entityName: string;
  season1: string;
  season2: string;
  viewMode: "player" | "team" | "league";
}

export function ComparisonShotChart({ entityName, season1, season2, viewMode }: ComparisonShotChartProps) {
  const { players: players1, loading: loading1 } = useAvailablePlayers(season1);
  const { players: players2, loading: loading2 } = useAvailablePlayers(season2);
  
  // Convert player name to player ID for data fetching
  const getEntityId = (season: string, isSecondSeason = false) => {
    if (viewMode === 'player') {
      const players = isSecondSeason ? players2 : players1;
      const loading = isSecondSeason ? loading2 : loading1;
      
      if (loading || !players.length) {
        console.log(`🔍 ComparisonShotChart: Players still loading for ${season}, returning undefined`);
        return undefined;
      }
      
      const player = players.find(p => p.name === entityName);
      console.log(`🔍 ComparisonShotChart: Found player for "${entityName}" in ${season}:`, player);
      return player?.id || entityName;
    }
    return entityName; // For teams, use the name directly
  };
  
  const entityId1 = getEntityId(season1);
  const entityId2 = getEntityId(season2, true);
  
  console.log(`🔍 ComparisonShotChart: entityName="${entityName}", entityId1="${entityId1}", entityId2="${entityId2}", loading1=${loading1}, loading2=${loading2}`);
  
  // Don't fetch data until we have valid entity IDs
  if (viewMode === 'player' && (!entityId1 || !entityId2 || loading1 || loading2)) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-6 bg-card border-border shadow-card">
          <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
            {entityName} ({season1})
          </h3>
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse">Loading chart data...</div>
          </div>
        </Card>
        <Card className="p-6 bg-card border-border shadow-card">
          <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
            {entityName} ({season2})
          </h3>
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse">Loading chart data...</div>
          </div>
        </Card>
      </div>
    );
  }
  
  const multiSeasonData = useMultiSeasonData(season1, season2, entityId1 || '', entityId2 || '', viewMode);
  
  if (multiSeasonData.season1.error || multiSeasonData.season2?.error) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-6 bg-card border-border shadow-card">
          <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
            {entityName} ({season1})
          </h3>
          <p className="text-destructive text-center">
            Error loading data: {multiSeasonData.season1.error}
          </p>
        </Card>
        <Card className="p-6 bg-card border-border shadow-card">
          <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
            {entityName} ({season2})
          </h3>
          <p className="text-destructive text-center">
            Error loading data: {multiSeasonData.season2?.error}
          </p>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <ShotChart
        title={`${entityName} (${season1})`}
        data={multiSeasonData.season1.loading ? undefined : multiSeasonData.season1.data}
      />
      <ShotChart
        title={`${entityName} (${season2})`}
        data={multiSeasonData.season2?.loading ? undefined : multiSeasonData.season2?.data}
      />
    </div>
  );
}