import { useMemo } from "react";
import { EntityShotChart } from "./EntityShotChart";
import { EntityStatistics } from "./EntityStatistics";
import { EntityVsEntityComparison } from "./EntityVsEntityComparison";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { useBatchShotData } from "@/hooks/useBatchShotData";

interface BatchEntityLayoutProps {
  entity1: string;
  entity2: string;
  season1: string;
  season2: string;
  viewMode: "player" | "team";
}

export function BatchEntityLayout({ 
  entity1, 
  entity2, 
  season1, 
  season2, 
  viewMode 
}: BatchEntityLayoutProps) {
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

  // Show loading state
  const isLoading = Object.values(batchResults).some(result => result?.loading);
  const hasError = Object.values(batchResults).some(result => result?.error);

  if (playersLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Season 1 Loading */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{season1} Season</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-64 bg-muted animate-pulse rounded-lg flex items-center justify-center">
                Loading {entity1} shot chart...
              </div>
              <div className="h-64 bg-muted animate-pulse rounded-lg flex items-center justify-center">
                Loading {entity2} shot chart...
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-64 bg-muted animate-pulse rounded-lg flex items-center justify-center">
                Loading {entity1} statistics...
              </div>
              <div className="h-64 bg-muted animate-pulse rounded-lg flex items-center justify-center">
                Loading {entity2} statistics...
              </div>
            </div>
          </div>
          
          {/* Season 2 Loading */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{season2} Season</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-64 bg-muted animate-pulse rounded-lg flex items-center justify-center">
                Loading {entity1} shot chart...
              </div>
              <div className="h-64 bg-muted animate-pulse rounded-lg flex items-center justify-center">
                Loading {entity2} shot chart...
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-64 bg-muted animate-pulse rounded-lg flex items-center justify-center">
                Loading {entity1} statistics...
              </div>
              <div className="h-64 bg-muted animate-pulse rounded-lg flex items-center justify-center">
                Loading {entity2} statistics...
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    const errorMessages = Object.values(batchResults)
      .filter(result => result?.error)
      .map(result => result!.error);
    
    return (
      <div className="text-center p-8">
        <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Data</h3>
        <p className="text-muted-foreground">{errorMessages.join(', ')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Shot Charts Grid */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-center">Shot Charts</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Season 1 Charts */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center">{season1} Season</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BatchEntityShotChart 
                entityName={entity1}
                season={season1}
                viewMode={viewMode}
                shotData={batchResults[`${entity1}_${season1}`]?.data || []}
              />
              <BatchEntityShotChart 
                entityName={entity2}
                season={season1}
                viewMode={viewMode}
                shotData={batchResults[`${entity2}_${season1}`]?.data || []}
              />
            </div>
          </div>

          {/* Season 2 Charts */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center">{season2} Season</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BatchEntityShotChart 
                entityName={entity1}
                season={season2}
                viewMode={viewMode}
                shotData={batchResults[`${entity1}_${season2}`]?.data || []}
              />
              <BatchEntityShotChart 
                entityName={entity2}
                season={season2}
                viewMode={viewMode}
                shotData={batchResults[`${entity2}_${season2}`]?.data || []}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-center">Statistics</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Season 1 Statistics */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center">{season1} Season</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BatchEntityStatistics 
                entityName={entity1}
                season={season1}
                viewMode={viewMode}
                shotData={batchResults[`${entity1}_${season1}`]?.data || []}
              />
              <BatchEntityStatistics 
                entityName={entity2}
                season={season1}
                viewMode={viewMode}
                shotData={batchResults[`${entity2}_${season1}`]?.data || []}
              />
            </div>
          </div>

          {/* Season 2 Statistics */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center">{season2} Season</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BatchEntityStatistics 
                entityName={entity1}
                season={season2}
                viewMode={viewMode}
                shotData={batchResults[`${entity1}_${season2}`]?.data || []}
              />
              <BatchEntityStatistics 
                entityName={entity2}
                season={season2}
                viewMode={viewMode}
                shotData={batchResults[`${entity2}_${season2}`]?.data || []}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Tables */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-center">Head-to-Head Comparisons</h2>
        <div className="space-y-8">
          <BatchEntityComparison
            entity1={entity1}
            entity2={entity2}
            season={season1}
            viewMode={viewMode}
            entity1Data={batchResults[`${entity1}_${season1}`]?.data || []}
            entity2Data={batchResults[`${entity2}_${season1}`]?.data || []}
          />
          <BatchEntityComparison
            entity1={entity1}
            entity2={entity2}
            season={season2}
            viewMode={viewMode}
            entity1Data={batchResults[`${entity1}_${season2}`]?.data || []}
            entity2Data={batchResults[`${entity2}_${season2}`]?.data || []}
          />
        </div>
      </div>
    </div>
  );
}

// Helper components that accept pre-fetched data
function BatchEntityShotChart({ entityName, season, viewMode, shotData }: any) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-center">{entityName} ({season})</h4>
      <div className="aspect-square bg-card rounded-lg border p-4">
        {shotData.length > 0 ? (
          <div className="text-center text-xs text-muted-foreground">
            {shotData.length.toLocaleString()} total shots
          </div>
        ) : (
          <div className="text-center text-muted-foreground">No shot data</div>
        )}
      </div>
    </div>
  );
}

function BatchEntityStatistics({ entityName, season, viewMode, shotData }: any) {
  const stats = calculateStats(shotData);
  
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-center">{entityName} ({season})</h4>
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-primary">{stats.fgPct.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">FG%</div>
            <div className="text-xs text-muted-foreground">{stats.madeShots}/{stats.totalShots}</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600">{stats.twoPtPct.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">2PT%</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-yellow-600">{stats.threePtPct.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">3PT%</div>
          </div>
          <div>
            <div className="text-lg font-bold">{stats.totalShots.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Shots</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BatchEntityComparison({ entity1, entity2, season, viewMode, entity1Data, entity2Data }: any) {
  const entity1Stats = calculateStats(entity1Data);
  const entity2Stats = calculateStats(entity2Data);

  const getComparisonIcon = (value1: number, value2: number) => {
    if (value1 > value2) return "↗️";
    if (value1 < value2) return "↘️";
    return "➡️";
  };

  return (
    <div className="bg-card rounded-lg border p-6">
      <h3 className="text-lg font-semibold text-center mb-4">
        {entity1} vs {entity2} - {season}
      </h3>
      <div className="grid grid-cols-4 gap-4 text-center">
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-2">FG%</div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <span>{getComparisonIcon(entity1Stats.fgPct, entity2Stats.fgPct)}</span>
              <span className="font-bold">{entity1Stats.fgPct.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <span>{getComparisonIcon(entity2Stats.fgPct, entity1Stats.fgPct)}</span>
              <span className="font-bold">{entity2Stats.fgPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-2">2PT%</div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <span>{getComparisonIcon(entity1Stats.twoPtPct, entity2Stats.twoPtPct)}</span>
              <span className="font-bold">{entity1Stats.twoPtPct.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <span>{getComparisonIcon(entity2Stats.twoPtPct, entity1Stats.twoPtPct)}</span>
              <span className="font-bold">{entity2Stats.twoPtPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-2">3PT%</div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <span>{getComparisonIcon(entity1Stats.threePtPct, entity2Stats.threePtPct)}</span>
              <span className="font-bold">{entity1Stats.threePtPct.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <span>{getComparisonIcon(entity2Stats.threePtPct, entity1Stats.threePtPct)}</span>
              <span className="font-bold">{entity2Stats.threePtPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground mb-2">Total Shots</div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <span>{getComparisonIcon(entity1Stats.totalShots, entity2Stats.totalShots)}</span>
              <span className="font-bold">{entity1Stats.totalShots.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <span>{getComparisonIcon(entity2Stats.totalShots, entity1Stats.totalShots)}</span>
              <span className="font-bold">{entity2Stats.totalShots.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function calculateStats(shotData: any[]) {
  if (!shotData || shotData.length === 0) {
    return {
      fgPct: 0,
      twoPtPct: 0,
      threePtPct: 0,
      totalShots: 0,
      madeShots: 0
    };
  }

  const totalShots = shotData.length;
  const madeShots = shotData.filter(shot => shot.shotResult === 'Made').length;
  const twoPointers = shotData.filter(shot => shot.shotValue === 2);
  const threePointers = shotData.filter(shot => shot.shotValue === 3);
  
  const madeTwoPointers = twoPointers.filter(shot => shot.shotResult === 'Made').length;
  const madeThreePointers = threePointers.filter(shot => shot.shotResult === 'Made').length;

  return {
    fgPct: totalShots > 0 ? (madeShots / totalShots) * 100 : 0,
    twoPtPct: twoPointers.length > 0 ? (madeTwoPointers / twoPointers.length) * 100 : 0,
    threePtPct: threePointers.length > 0 ? (madeThreePointers / threePointers.length) * 100 : 0,
    totalShots,
    madeShots
  };
}