import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Target, MapPin } from "lucide-react";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { useSupabaseShotData } from "@/hooks/useSupabaseShotData";

interface EntityVsEntityComparisonProps {
  entity1: string;
  entity2: string;
  season: string;
  viewMode: "player" | "team";
  preloadedEntity1Data?: any[]; // Optional preloaded data for entity1
  preloadedEntity2Data?: any[]; // Optional preloaded data for entity2
}

export function EntityVsEntityComparison({ entity1, entity2, season, viewMode, preloadedEntity1Data, preloadedEntity2Data }: EntityVsEntityComparisonProps) {
  const { players: playersData, loading: playersLoading } = useAvailablePlayers(season);

  // Get entity IDs
  const getEntityId = (entityName: string) => {
    if (viewMode === 'team') {
      return entityName;
    }
    
    const player = playersData?.find(p => p.name === entityName);
    return player ? player.id.toString() : entityName;
  };

  const entity1Id = getEntityId(entity1);
  const entity2Id = getEntityId(entity2);

  // Use preloaded data if available, otherwise fetch via hook
  const entity1Data = preloadedEntity1Data !== undefined 
    ? { shotData: preloadedEntity1Data, loading: false, error: null }
    : useSupabaseShotData(season, entity1Id, viewMode);
  
  const entity2Data = preloadedEntity2Data !== undefined 
    ? { shotData: preloadedEntity2Data, loading: false, error: null }
    : useSupabaseShotData(season, entity2Id, viewMode);

  // Zone analysis helper
  const analyzeZones = (shotData: any[]) => {
    const zones = {
      "Restricted Area": { made: 0, total: 0 },
      "Paint": { made: 0, total: 0 },
      "Mid Range": { made: 0, total: 0 },
      "Left Corner 3": { made: 0, total: 0 },
      "Right Corner 3": { made: 0, total: 0 },
      "Above Break 3": { made: 0, total: 0 },
    };

    shotData.forEach(shot => {
      const distance = shot.shotDistance || 0;
      const x = shot.xLegacy || 0;
      const y = shot.yLegacy || 0;

      let zone = "Mid Range";
      
      if (distance <= 4) {
        zone = "Restricted Area";
      } else if (distance <= 10 && y <= 80) {
        zone = "Paint";
      } else if (shot.shotValue === 3) {
        if ((x <= -220 && y <= 90) || (x >= 220 && y <= 90)) {
          zone = x <= -220 ? "Left Corner 3" : "Right Corner 3";
        } else {
          zone = "Above Break 3";
        }
      }

      zones[zone as keyof typeof zones].total++;
      if (shot.shotResult === 'Made') {
        zones[zone as keyof typeof zones].made++;
      }
    });

    const zoneStats = Object.entries(zones).map(([name, stats]) => ({
      name,
      percentage: stats.total > 0 ? (stats.made / stats.total) * 100 : 0,
      made: stats.made,
      total: stats.total
    })).filter(zone => zone.total > 0);

    const hottest = zoneStats.reduce((prev, curr) => 
      (prev.percentage > curr.percentage) ? prev : curr, zoneStats[0] || { name: "N/A", percentage: 0, made: 0, total: 0 });
    
    const coldest = zoneStats.reduce((prev, curr) => 
      (prev.percentage < curr.percentage) ? prev : curr, zoneStats[0] || { name: "N/A", percentage: 0, made: 0, total: 0 });
    
    const favorite = zoneStats.reduce((prev, curr) => 
      (prev.total > curr.total) ? prev : curr, zoneStats[0] || { name: "N/A", percentage: 0, made: 0, total: 0 });

    return { hottest, coldest, favorite };
  };

  const calculateStats = (data: any[]) => {
    const totalShots = data.length;
    const madeShots = data.filter(shot => shot.shotResult === 'Made').length;
    const twoPointers = data.filter(shot => shot.shotValue === 2);
    const threePointers = data.filter(shot => shot.shotValue === 3);
    
    const twoPointMade = twoPointers.filter(shot => shot.shotResult === 'Made').length;
    const threePointMade = threePointers.filter(shot => shot.shotResult === 'Made').length;
    
    const fgPercent = totalShots > 0 ? (madeShots / totalShots) * 100 : 0;
    const twoPtPercent = twoPointers.length > 0 ? (twoPointMade / twoPointers.length) * 100 : 0;
    const threePtPercent = threePointers.length > 0 ? (threePointMade / threePointers.length) * 100 : 0;
    
    const zones = analyzeZones(data);
    
    return {
      fgPercent: Math.round(fgPercent * 10) / 10,
      twoPtPercent: Math.round(twoPtPercent * 10) / 10,
      threePtPercent: Math.round(threePtPercent * 10) / 10,
      totalShots,
      madeShots,
      zones
    };
  };

  if (playersLoading || entity1Data.loading || entity2Data.loading) {
    return (
      <Card className="p-6 bg-card border-border shadow-card">
        <p className="text-muted-foreground text-center">Loading comparison data...</p>
      </Card>
    );
  }

  if (entity1Data.error || entity2Data.error) {
    return (
      <Card className="p-6 bg-card border-border shadow-card">
        <p className="text-destructive text-center">Error loading data</p>
      </Card>
    );
  }

  const entity1Stats = calculateStats(entity1Data.shotData);
  const entity2Stats = calculateStats(entity2Data.shotData);

  const getComparisonIcon = (value1: number, value2: number) => {
    if (value1 > value2) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (value1 < value2) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getComparisonColor = (value1: number, value2: number) => {
    if (value1 > value2) return "text-green-500";
    if (value1 < value2) return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Head-to-Head Comparison */}
      <Card className="bg-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {entity1} vs {entity2} ({season})
          </CardTitle>
          <CardDescription>Head-to-Head Statistical Comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Field Goal % */}
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">Field Goal %</div>
              <div className="flex items-center justify-center gap-2">
                <span className={`text-lg font-bold ${getComparisonColor(entity1Stats.fgPercent, entity2Stats.fgPercent)}`}>
                  {entity1Stats.fgPercent}%
                </span>
                {getComparisonIcon(entity1Stats.fgPercent, entity2Stats.fgPercent)}
                <span className={`text-lg font-bold ${getComparisonColor(entity2Stats.fgPercent, entity1Stats.fgPercent)}`}>
                  {entity2Stats.fgPercent}%
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {entity1} vs {entity2}
              </div>
            </div>

            {/* 2PT % */}
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">2-Point %</div>
              <div className="flex items-center justify-center gap-2">
                <span className={`text-lg font-bold ${getComparisonColor(entity1Stats.twoPtPercent, entity2Stats.twoPtPercent)}`}>
                  {entity1Stats.twoPtPercent}%
                </span>
                {getComparisonIcon(entity1Stats.twoPtPercent, entity2Stats.twoPtPercent)}
                <span className={`text-lg font-bold ${getComparisonColor(entity2Stats.twoPtPercent, entity1Stats.twoPtPercent)}`}>
                  {entity2Stats.twoPtPercent}%
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {entity1} vs {entity2}
              </div>
            </div>

            {/* 3PT % */}
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">3-Point %</div>
              <div className="flex items-center justify-center gap-2">
                <span className={`text-lg font-bold ${getComparisonColor(entity1Stats.threePtPercent, entity2Stats.threePtPercent)}`}>
                  {entity1Stats.threePtPercent}%
                </span>
                {getComparisonIcon(entity1Stats.threePtPercent, entity2Stats.threePtPercent)}
                <span className={`text-lg font-bold ${getComparisonColor(entity2Stats.threePtPercent, entity1Stats.threePtPercent)}`}>
                  {entity2Stats.threePtPercent}%
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {entity1} vs {entity2}
              </div>
            </div>

            {/* Total Shots */}
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">Total Shots</div>
              <div className="flex items-center justify-center gap-2">
                <span className={`text-lg font-bold ${getComparisonColor(entity1Stats.totalShots, entity2Stats.totalShots)}`}>
                  {entity1Stats.totalShots}
                </span>
                {getComparisonIcon(entity1Stats.totalShots, entity2Stats.totalShots)}
                <span className={`text-lg font-bold ${getComparisonColor(entity2Stats.totalShots, entity1Stats.totalShots)}`}>
                  {entity2Stats.totalShots}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {entity1} vs {entity2}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}