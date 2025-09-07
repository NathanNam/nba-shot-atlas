import { useEffect } from "react";
import { ShotChart } from "@/components/ui/shot-chart";
import { useMultiSeasonData } from "@/hooks/useMultiSeasonData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { Card } from "@/components/ui/card";
import { useNBAAnalyticsTracking } from "@/components/UserInteractionTracker";
import { PerformanceMonitor, trackDataLoading } from "@/components/PerformanceMonitor";

interface ComparisonShotChartProps {
  entityName: string;
  season1: string;
  season2: string;
  viewMode: "player" | "team" | "league";
}

export function ComparisonShotChart({ entityName, season1, season2, viewMode }: ComparisonShotChartProps) {
  const { trackComparisonView, trackShotChartInteraction } = useNBAAnalyticsTracking();
  
  // Always call hooks but only use results in player mode
  const { players: rawPlayers1, loading: rawLoading1 } = useAvailablePlayers();
  const { players: rawPlayers2, loading: rawLoading2 } = useAvailablePlayers();
  
  const players1 = viewMode === "player" ? rawPlayers1 : [];
  const loading1 = viewMode === "player" ? rawLoading1 : false;
  const players2 = viewMode === "player" ? rawPlayers2 : [];
  const loading2 = viewMode === "player" ? rawLoading2 : false;
  
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
  
  // Always call useMultiSeasonData hook - never conditionally call hooks
  const multiSeasonData = useMultiSeasonData(season1, season2, entityId1 || '', entityId2 || '', viewMode);

  // Track comparison view and data loading performance
  useEffect(() => {
    if (!multiSeasonData.season1.loading && !multiSeasonData.season2?.loading) {
      const startTime = Date.now();
      
      if (multiSeasonData.season1.data && multiSeasonData.season2?.data) {
        const loadDuration = Date.now() - startTime;
        
        trackDataLoading(
          `comparison_shot_chart_${viewMode}_${entityName}`,
          loadDuration,
          false,
          (multiSeasonData.season1.data?.length || 0) + (multiSeasonData.season2.data?.length || 0)
        );
        
        trackComparisonView(season1, season2, viewMode);
        
        trackShotChartInteraction('comparison_chart_rendered', {
          entity_name: entityName,
          entity_type: viewMode,
          season1,
          season2,
          shots_count_s1: multiSeasonData.season1.data?.length || 0,
          shots_count_s2: multiSeasonData.season2.data?.length || 0,
        });
      }
    }
  }, [
    multiSeasonData.season1.loading, 
    multiSeasonData.season2?.loading,
    multiSeasonData.season1.data,
    multiSeasonData.season2?.data,
    viewMode,
    entityName,
    season1,
    season2
  ]);
  
  // Handle loading states after hooks are called
  if (viewMode === 'player' && (!entityId1 || !entityId2 || loading1 || loading2)) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-6 bg-card border-border shadow-card">
          <h3 className="text-fluid-heading text-foreground mb-4 text-center">
            {entityName} ({season1})
          </h3>
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse">Loading chart data...</div>
          </div>
        </Card>
        <Card className="p-6 bg-card border-border shadow-card">
          <h3 className="text-fluid-heading text-foreground mb-4 text-center">
            {entityName} ({season2})
          </h3>
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse">Loading chart data...</div>
          </div>
        </Card>
      </div>
    );
  }
  if (multiSeasonData.season1.error || multiSeasonData.season2?.error) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="p-6 bg-card border-border shadow-card">
          <h3 className="text-fluid-heading text-foreground mb-4 text-center">
            {entityName} ({season1})
          </h3>
          <p className="text-destructive text-center">
            Error loading data: {multiSeasonData.season1.error}
          </p>
        </Card>
        <Card className="p-6 bg-card border-border shadow-card">
          <h3 className="text-fluid-heading text-foreground mb-4 text-center">
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
    <PerformanceMonitor componentName={`ComparisonShotChart-${viewMode}`}>
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
    </PerformanceMonitor>
  );
}