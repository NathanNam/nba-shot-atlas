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

  // Get entity IDs - hardcoded for testing to match EntityShotChart logic
  const getEntityId = (entityName: string) => {
    if (viewMode === 'team') {
      return entityName;
    }
    
    // Hardcoded player IDs to match working shot charts
    if (entityName === 'Stephen Curry') return '201939';
    if (entityName === 'LeBron James') return '2544';
    
    const player = playersData?.find(p => p.name === entityName);
    console.log(`🔍 BatchEntityLayout: Looking for "${entityName}", found player:`, player);
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
  
  // Debug logging - Enhanced
  console.log('🔍 BatchEntityLayout: Complete debug info', {
    entity1, entity2, season1, season2, viewMode,
    entity1Id, entity2Id,
    playersLoading,
    batchRequestsCount: batchRequests.length,
    batchRequests: batchRequests.map(r => ({ key: r.key, entityId: r.entityId, season: r.season })),
    resultKeys: Object.keys(batchResults),
    resultSummary: Object.entries(batchResults).map(([key, value]) => ({
      key,
      dataLength: value?.data?.length || 0,
      loading: value?.loading,
      error: value?.error,
      firstRecord: value?.data?.[0]
    }))
  });

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
      {/* Statistics Grid - Reorganized by season rows */}
      <div className="space-y-6">
        {/* Row 3: Two stats charts for 2024-25 Season */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EntityStatistics 
            entityName={`${entity1} (${season1})`}
            selectedSeason={season1}
            viewMode={viewMode}
            preloadedData={batchResults[`${entity1}_${season1}`]?.data}
          />
          <EntityStatistics 
            entityName={`${entity2} (${season1})`}
            selectedSeason={season1}
            viewMode={viewMode}
            preloadedData={batchResults[`${entity2}_${season1}`]?.data}
          />
        </div>

        {/* Row 4: Two stats charts for 2023-24 Season */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <EntityStatistics 
            entityName={`${entity1} (${season2})`}
            selectedSeason={season2}
            viewMode={viewMode}
            preloadedData={batchResults[`${entity1}_${season2}`]?.data}
          />
          <EntityStatistics 
            entityName={`${entity2} (${season2})`}
            selectedSeason={season2}
            viewMode={viewMode}
            preloadedData={batchResults[`${entity2}_${season2}`]?.data}
          />
        </div>
      </div>

      {/* Head-to-Head Comparisons - Debug data passed */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-center">Head-to-Head Comparisons</h2>
        <div className="space-y-8">
          <EntityVsEntityComparison
            entity1={entity1}
            entity2={entity2}
            season={season1}
            viewMode={viewMode}
            preloadedEntity1Data={(() => {
              const data = batchResults[`${entity1}_${season1}`]?.data;
              console.log(`🔍 BatchEntityLayout: Passing ${entity1} ${season1} data:`, { 
                dataLength: data?.length, 
                dataSample: data?.slice(0, 2) 
              });
              return data;
            })()}
            preloadedEntity2Data={(() => {
              const data = batchResults[`${entity2}_${season1}`]?.data;
              console.log(`🔍 BatchEntityLayout: Passing ${entity2} ${season1} data:`, { 
                dataLength: data?.length, 
                dataSample: data?.slice(0, 2) 
              });
              return data;
            })()}
          />
          <EntityVsEntityComparison
            entity1={entity1}
            entity2={entity2}
            season={season2}
            viewMode={viewMode}
            preloadedEntity1Data={(() => {
              const data = batchResults[`${entity1}_${season2}`]?.data;
              console.log(`🔍 BatchEntityLayout: Passing ${entity1} ${season2} data:`, { 
                dataLength: data?.length, 
                dataSample: data?.slice(0, 2) 
              });
              return data;
            })()}
            preloadedEntity2Data={(() => {
              const data = batchResults[`${entity2}_${season2}`]?.data;
              console.log(`🔍 BatchEntityLayout: Passing ${entity2} ${season2} data:`, { 
                dataLength: data?.length, 
                dataSample: data?.slice(0, 2) 
              });
              return data;
            })()}
          />
        </div>
      </div>
    </div>
  );
}