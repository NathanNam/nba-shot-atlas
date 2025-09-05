import { useSupabaseShotData } from "@/hooks/useSupabaseShotData";
import { StatisticsPanel } from "@/components/ui/statistics-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LeagueStatisticsProps {
  selectedSeason: string;
}

export function LeagueStatistics({ selectedSeason }: LeagueStatisticsProps) {
  // Use full dataset with progressive loading
  const { shotData, loading, error, progress } = useSupabaseShotData(selectedSeason, "", "league");
  
  console.log('League Statistics - Season:', selectedSeason, 'Data length:', shotData.length, 'Error:', error, 'Progress:', progress);

  if (loading || progress) {
    const progressText = progress 
      ? `Loading: ${progress.loaded.toLocaleString()}${progress.total ? ` / ${progress.total.toLocaleString()}` : ''} shots`
      : 'Loading league statistics...';
      
    return (
      <Card>
        <CardHeader>
          <CardTitle>League Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center text-muted-foreground">{progressText}</div>
            {progress && progress.total && (
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${(progress.loaded / progress.total) * 100}%` }}
                />
              </div>
            )}
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>League Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Error loading league data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate league-wide statistics
  const totalShots = shotData.length;
  const madeShots = shotData.filter(shot => shot.shotResult === "Made").length;
  const threePointers = shotData.filter(shot => shot.shotValue === 3);
  const twoPointers = shotData.filter(shot => shot.shotValue === 2);
  
  const made3PT = threePointers.filter(shot => shot.shotResult === "Made").length;
  const made2PT = twoPointers.filter(shot => shot.shotResult === "Made").length;

  // Calculate zone statistics for hottest/coldest spots
  const zoneStats = new Map<string, { made: number; total: number }>();
  
  shotData.forEach(shot => {
    const zone = getZoneFromCoordinates(shot.xLegacy, shot.yLegacy);
    const current = zoneStats.get(zone) || { made: 0, total: 0 };
    current.total++;
    if (shot.shotResult === "Made") {
      current.made++;
    }
    zoneStats.set(zone, current);
  });

  const zonePercentages = Array.from(zoneStats.entries())
    .map(([zone, stats]) => ({
      zone,
      percentage: stats.total > 0 ? stats.made / stats.total : 0,
      total: stats.total
    }))
    .filter(z => z.total >= 100) // Only zones with meaningful sample size
    .sort((a, b) => b.percentage - a.percentage);

  const hottestZone = zonePercentages[0];
  const coldestZone = zonePercentages[zonePercentages.length - 1];
  
  // Find most popular shooting zone
  const favoriteZone = Array.from(zoneStats.entries())
    .sort((a, b) => b[1].total - a[1].total)[0];

  const stats = {
    fieldGoalPercentage: totalShots > 0 ? (madeShots / totalShots) : 0,
    twoPointPercentage: twoPointers.length > 0 ? (made2PT / twoPointers.length) : 0,
    twoPointMade: made2PT,
    twoPointAttempted: twoPointers.length,
    threePointPercentage: threePointers.length > 0 ? (made3PT / threePointers.length) : 0,
    threePointMade: made3PT,
    threePointAttempted: threePointers.length,
    totalShots,
    madeShots: madeShots,
    hottestZone: hottestZone ? `${hottestZone.zone} (${(hottestZone.percentage * 100).toFixed(1)}%)` : "N/A",
    coldestZone: coldestZone ? `${coldestZone.zone} (${(coldestZone.percentage * 100).toFixed(1)}%)` : "N/A",
    favoriteSpot: favoriteZone ? `${favoriteZone[0]} (${favoriteZone[1].total} shots)` : "N/A"
  };

  return (
    <StatisticsPanel 
      entityName={`NBA League (${selectedSeason})`}
      stats={stats}
    />
  );
}

function getZoneFromCoordinates(x: number, y: number): string {
  // Convert coordinates to zones based on basketball court layout
  const distance = Math.sqrt(x * x + y * y);
  
  if (distance <= 40) {
    return "Restricted Area";
  } else if (distance <= 80) {
    return "Paint";
  } else if (distance <= 140) {
    return "Mid Range";
  } else if (y > 140) {
    if (x < -80) {
      return "Left Corner 3";
    } else if (x > 80) {
      return "Right Corner 3";
    } else {
      return "Above the Break 3";
    }
  } else {
    return "Long 2";
  }
}