import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Target, MapPin } from "lucide-react";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { useBatchShotData } from "@/hooks/useBatchShotData";
import { ShotData } from "@/services/supabaseDataService";

interface BatchEntityVsEntityDualSeasonComparisonProps {
  entity1: string;
  entity2: string;
  season1: string;
  season2: string;
  viewMode: "player" | "team";
}

export function BatchEntityVsEntityDualSeasonComparison({ 
  entity1, 
  entity2, 
  season1, 
  season2, 
  viewMode 
}: BatchEntityVsEntityDualSeasonComparisonProps) {
  const { players: playersData, loading: playersLoading } = useAvailablePlayers(season1);

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

  // Create batch requests for all 4 combinations
  const batchRequests = useMemo(() => {
    if (playersLoading || !entity1Id || !entity2Id) {
      return [];
    }

    return [
      {
        season: season1,
        entityId: entity1Id,
        viewMode,
        key: `${entity1}_${season1}`
      },
      {
        season: season1,
        entityId: entity2Id,
        viewMode,
        key: `${entity2}_${season1}`
      },
      {
        season: season2,
        entityId: entity1Id,
        viewMode,
        key: `${entity1}_${season2}`
      },
      {
        season: season2,
        entityId: entity2Id,
        viewMode,
        key: `${entity2}_${season2}`
      }
    ];
  }, [entity1Id, entity2Id, season1, season2, viewMode, playersLoading]);

  const batchResults = useBatchShotData(batchRequests);

  // Helper functions for statistics calculation
  const calculateStats = (shotData: ShotData[]) => {
    if (!shotData || shotData.length === 0) {
      return {
        fgPct: 0,
        twoPtPct: 0,
        threePtPct: 0,
        totalShots: 0,
        madeShots: 0
      };
    }

    const totals = shotData.reduce(
      (acc, shot) => {
        acc.totalShots++;
        const made = shot.shotResult === "Made";
        if (made) acc.madeShots++;

        if (shot.shotValue === 2) {
          acc.twoPtAttempts++;
          if (made) acc.twoPtMakes++;
        } else if (shot.shotValue === 3) {
          acc.threePtAttempts++;
          if (made) acc.threePtMakes++;
        }
        return acc;
      },
      {
        totalShots: 0,
        madeShots: 0,
        twoPtAttempts: 0,
        twoPtMakes: 0,
        threePtAttempts: 0,
        threePtMakes: 0
      }
    );

    return {
      fgPct: totals.totalShots > 0 ? (totals.madeShots / totals.totalShots) * 100 : 0,
      twoPtPct: totals.twoPtAttempts > 0 ? (totals.twoPtMakes / totals.twoPtAttempts) * 100 : 0,
      threePtPct: totals.threePtAttempts > 0 ? (totals.threePtMakes / totals.threePtAttempts) * 100 : 0,
      totalShots: totals.totalShots,
      madeShots: totals.madeShots
    };
  };

  const getComparisonIcon = (value1: number, value2: number) => {
    if (value1 > value2) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (value1 < value2) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getComparisonColor = (value1: number, value2: number) => {
    if (value1 > value2) return "text-green-600 dark:text-green-400";
    if (value1 < value2) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  // Show loading state
  const isLoading = Object.values(batchResults).some(result => result?.loading);
  const criticalErrors = Object.values(batchResults).filter(result => result?.error && result?.data?.length === 0);
  const partialErrors = Object.values(batchResults).filter(result => result?.error && result?.data?.length > 0);

  if (playersLoading || isLoading) {
    return (
      <div className="space-y-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Loading Parallel Data...</CardTitle>
            <CardDescription>
              Fetching data for all {viewMode} combinations simultaneously
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Only show error if there are critical errors (no data at all)
  if (criticalErrors.length > 0) {
    const errorMessages = criticalErrors.map(result => result!.error);
    
    return (
      <div className="space-y-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Error Loading Data</CardTitle>
            <CardDescription>
              {errorMessages.join(', ')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Get data for each combination
  const entity1Season1Data = batchResults[`${entity1}_${season1}`]?.data || [];
  const entity2Season1Data = batchResults[`${entity2}_${season1}`]?.data || [];
  const entity1Season2Data = batchResults[`${entity1}_${season2}`]?.data || [];
  const entity2Season2Data = batchResults[`${entity2}_${season2}`]?.data || [];

  // Calculate stats for all combinations
  const entity1Season1Stats = calculateStats(entity1Season1Data);
  const entity2Season1Stats = calculateStats(entity2Season1Data);
  const entity1Season2Stats = calculateStats(entity1Season2Data);
  const entity2Season2Stats = calculateStats(entity2Season2Data);

  return (
    <div className="space-y-8">
      {/* Show partial error warnings if any */}
      {partialErrors.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <CardHeader>
            <CardTitle className="text-yellow-800 dark:text-yellow-200 text-sm">
              Partial Data Warning
            </CardTitle>
            <CardDescription className="text-yellow-600 dark:text-yellow-400 text-xs">
              Some data may be incomplete due to timeout issues. Showing available data.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Season 1 Comparison */}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Target className="h-5 w-5" />
            {entity1} vs {entity2}
          </CardTitle>
          <CardDescription>{season1} Season Comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* FG% */}
            <div className="text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground">FG%</div>
              <div className="flex flex-col gap-1">
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity1Season1Stats.fgPct, entity2Season1Stats.fgPct)}`}>
                  {getComparisonIcon(entity1Season1Stats.fgPct, entity2Season1Stats.fgPct)}
                  <span className="font-bold">{entity1Season1Stats.fgPct.toFixed(1)}%</span>
                </div>
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity2Season1Stats.fgPct, entity1Season1Stats.fgPct)}`}>
                  {getComparisonIcon(entity2Season1Stats.fgPct, entity1Season1Stats.fgPct)}
                  <span className="font-bold">{entity2Season1Stats.fgPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* 2PT% */}
            <div className="text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground">2PT%</div>
              <div className="flex flex-col gap-1">
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity1Season1Stats.twoPtPct, entity2Season1Stats.twoPtPct)}`}>
                  {getComparisonIcon(entity1Season1Stats.twoPtPct, entity2Season1Stats.twoPtPct)}
                  <span className="font-bold">{entity1Season1Stats.twoPtPct.toFixed(1)}%</span>
                </div>
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity2Season1Stats.twoPtPct, entity1Season1Stats.twoPtPct)}`}>
                  {getComparisonIcon(entity2Season1Stats.twoPtPct, entity1Season1Stats.twoPtPct)}
                  <span className="font-bold">{entity2Season1Stats.twoPtPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* 3PT% */}
            <div className="text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground">3PT%</div>
              <div className="flex flex-col gap-1">
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity1Season1Stats.threePtPct, entity2Season1Stats.threePtPct)}`}>
                  {getComparisonIcon(entity1Season1Stats.threePtPct, entity2Season1Stats.threePtPct)}
                  <span className="font-bold">{entity1Season1Stats.threePtPct.toFixed(1)}%</span>
                </div>
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity2Season1Stats.threePtPct, entity1Season1Stats.threePtPct)}`}>
                  {getComparisonIcon(entity2Season1Stats.threePtPct, entity1Season1Stats.threePtPct)}
                  <span className="font-bold">{entity2Season1Stats.threePtPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Total Shots */}
            <div className="text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Total Shots</div>
              <div className="flex flex-col gap-1">
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity1Season1Stats.totalShots, entity2Season1Stats.totalShots)}`}>
                  {getComparisonIcon(entity1Season1Stats.totalShots, entity2Season1Stats.totalShots)}
                  <span className="font-bold">{entity1Season1Stats.totalShots.toLocaleString()}</span>
                </div>
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity2Season1Stats.totalShots, entity1Season1Stats.totalShots)}`}>
                  {getComparisonIcon(entity2Season1Stats.totalShots, entity1Season1Stats.totalShots)}
                  <span className="font-bold">{entity2Season1Stats.totalShots.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex justify-center gap-4">
            <Badge variant="outline">{entity1}</Badge>
            <Badge variant="outline">{entity2}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Season 2 Comparison */}
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Target className="h-5 w-5" />
            {entity1} vs {entity2}
          </CardTitle>
          <CardDescription>{season2} Season Comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* FG% */}
            <div className="text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground">FG%</div>
              <div className="flex flex-col gap-1">
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity1Season2Stats.fgPct, entity2Season2Stats.fgPct)}`}>
                  {getComparisonIcon(entity1Season2Stats.fgPct, entity2Season2Stats.fgPct)}
                  <span className="font-bold">{entity1Season2Stats.fgPct.toFixed(1)}%</span>
                </div>
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity2Season2Stats.fgPct, entity1Season2Stats.fgPct)}`}>
                  {getComparisonIcon(entity2Season2Stats.fgPct, entity1Season2Stats.fgPct)}
                  <span className="font-bold">{entity2Season2Stats.fgPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* 2PT% */}
            <div className="text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground">2PT%</div>
              <div className="flex flex-col gap-1">
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity1Season2Stats.twoPtPct, entity2Season2Stats.twoPtPct)}`}>
                  {getComparisonIcon(entity1Season2Stats.twoPtPct, entity2Season2Stats.twoPtPct)}
                  <span className="font-bold">{entity1Season2Stats.twoPtPct.toFixed(1)}%</span>
                </div>
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity2Season2Stats.twoPtPct, entity1Season2Stats.twoPtPct)}`}>
                  {getComparisonIcon(entity2Season2Stats.twoPtPct, entity1Season2Stats.twoPtPct)}
                  <span className="font-bold">{entity2Season2Stats.twoPtPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* 3PT% */}
            <div className="text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground">3PT%</div>
              <div className="flex flex-col gap-1">
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity1Season2Stats.threePtPct, entity2Season2Stats.threePtPct)}`}>
                  {getComparisonIcon(entity1Season2Stats.threePtPct, entity2Season2Stats.threePtPct)}
                  <span className="font-bold">{entity1Season2Stats.threePtPct.toFixed(1)}%</span>
                </div>
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity2Season2Stats.threePtPct, entity1Season2Stats.threePtPct)}`}>
                  {getComparisonIcon(entity2Season2Stats.threePtPct, entity1Season2Stats.threePtPct)}
                  <span className="font-bold">{entity2Season2Stats.threePtPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Total Shots */}
            <div className="text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Total Shots</div>
              <div className="flex flex-col gap-1">
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity1Season2Stats.totalShots, entity2Season2Stats.totalShots)}`}>
                  {getComparisonIcon(entity1Season2Stats.totalShots, entity2Season2Stats.totalShots)}
                  <span className="font-bold">{entity1Season2Stats.totalShots.toLocaleString()}</span>
                </div>
                <div className={`flex items-center justify-center gap-1 ${getComparisonColor(entity2Season2Stats.totalShots, entity1Season2Stats.totalShots)}`}>
                  {getComparisonIcon(entity2Season2Stats.totalShots, entity1Season2Stats.totalShots)}
                  <span className="font-bold">{entity2Season2Stats.totalShots.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex justify-center gap-4">
            <Badge variant="outline">{entity1}</Badge>
            <Badge variant="outline">{entity2}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}