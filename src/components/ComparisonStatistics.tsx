import { useMultiSeasonData } from "@/hooks/useMultiSeasonData";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { StatisticsPanel } from "@/components/ui/statistics-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ComparisonStatisticsProps {
  entityName: string;
  season1: string;
  season2: string;
  viewMode: "player" | "team" | "league";
}

export function ComparisonStatistics({ entityName, season1, season2, viewMode }: ComparisonStatisticsProps) {
  const { players: players1 } = useAvailablePlayers(season1);
  const { players: players2 } = useAvailablePlayers(season2);
  
  const getEntityId = (season: string, isSecondSeason = false) => {
    if (viewMode === 'player') {
      const players = isSecondSeason ? players2 : players1;
      const player = players.find(p => p.name === entityName);
      return player?.id || entityName;
    }
    return entityName;
  };
  
  const entityId1 = getEntityId(season1);
  const entityId2 = getEntityId(season2, true);
  const multiSeasonData = useMultiSeasonData(season1, season2, entityId1, viewMode);
  
  if (multiSeasonData.season1.loading || multiSeasonData.season2?.loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Statistics Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Season Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (multiSeasonData.season1.error || multiSeasonData.season2?.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Statistics Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Error loading comparison data</p>
        </CardContent>
      </Card>
    );
  }

  const data1 = multiSeasonData.season1.data;
  const data2 = multiSeasonData.season2?.data || [];
  
  // Calculate statistics for both seasons
  const calculateStats = (data: any[]) => {
    const totalShots = data.length;
    const madeShots = data.filter(shot => shot.shotResult === "Made").length;
    const threePointers = data.filter(shot => shot.shotValue === 3);
    const twoPointers = data.filter(shot => shot.shotValue === 2);
    const made3PT = threePointers.filter(shot => shot.shotResult === "Made").length;
    const made2PT = twoPointers.filter(shot => shot.shotResult === "Made").length;

    return {
      fieldGoalPercentage: totalShots > 0 ? (madeShots / totalShots) : 0,
      twoPointPercentage: twoPointers.length > 0 ? (made2PT / twoPointers.length) : 0,
      threePointPercentage: threePointers.length > 0 ? (made3PT / threePointers.length) : 0,
      totalShots,
      madeShots,
      hottestZone: "N/A", // Simplified for comparison view
      coldestZone: "N/A", // Simplified for comparison view  
      favoriteSpot: "N/A" // Simplified for comparison view
    };
  };

  const stats1 = calculateStats(data1);
  const stats2 = calculateStats(data2);
  
  // Calculate differences
  const fgDiff = stats2.fieldGoalPercentage - stats1.fieldGoalPercentage;
  const twoPtDiff = stats2.twoPointPercentage - stats1.twoPointPercentage;
  const threePtDiff = stats2.threePointPercentage - stats1.threePointPercentage;
  const shotsDiff = stats2.totalShots - stats1.totalShots;

  const getTrendIcon = (diff: number) => {
    if (Math.abs(diff) < 0.001) return <Minus className="h-4 w-4" />;
    return diff > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  const getTrendColor = (diff: number) => {
    if (Math.abs(diff) < 0.001) return "text-muted-foreground";
    return diff > 0 ? "text-green-500" : "text-red-500";
  };

  return (
    <div className="space-y-6">
      {/* Individual Season Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatisticsPanel 
          entityName={`${entityName} (${season1})`}
          stats={stats1}
        />
        <StatisticsPanel 
          entityName={`${entityName} (${season2})`}
          stats={stats2}
        />
      </div>
      
      {/* Comparison Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Season Comparison: {season2} vs {season1}
            <Badge variant="secondary" className="text-xs">
              {season2} → {season1}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center space-y-1">
              <div className="text-sm text-muted-foreground">FG%</div>
              <div className={`flex items-center justify-center gap-1 font-semibold ${getTrendColor(fgDiff)}`}>
                {getTrendIcon(fgDiff)}
                <span>{fgDiff >= 0 ? '+' : ''}{(fgDiff * 100).toFixed(1)}%</span>
              </div>
            </div>
            
            <div className="text-center space-y-1">
              <div className="text-sm text-muted-foreground">2PT%</div>
              <div className={`flex items-center justify-center gap-1 font-semibold ${getTrendColor(twoPtDiff)}`}>
                {getTrendIcon(twoPtDiff)}
                <span>{twoPtDiff >= 0 ? '+' : ''}{(twoPtDiff * 100).toFixed(1)}%</span>
              </div>
            </div>
            
            <div className="text-center space-y-1">
              <div className="text-sm text-muted-foreground">3PT%</div>
              <div className={`flex items-center justify-center gap-1 font-semibold ${getTrendColor(threePtDiff)}`}>
                {getTrendIcon(threePtDiff)}
                <span>{threePtDiff >= 0 ? '+' : ''}{(threePtDiff * 100).toFixed(1)}%</span>
              </div>
            </div>
            
            <div className="text-center space-y-1">
              <div className="text-sm text-muted-foreground">Total Shots</div>
              <div className={`flex items-center justify-center gap-1 font-semibold ${getTrendColor(shotsDiff)}`}>
                {getTrendIcon(shotsDiff)}
                <span>{shotsDiff >= 0 ? '+' : ''}{shotsDiff}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}