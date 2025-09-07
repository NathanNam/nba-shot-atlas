import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, Zap, Heart } from "lucide-react";
import { useEntityComparisonData } from "@/hooks/useEntityComparisonData";

interface MultiEntityStatisticsComparisonProps {
  entities: string[];
  selectedSeason: string;
  viewMode: "player" | "team" | "league";
}

export function MultiEntityStatisticsComparison({
  entities,
  selectedSeason,
  viewMode,
}: MultiEntityStatisticsComparisonProps) {
  const { statsData, isLoading, isError } = useEntityComparisonData(
    entities,
    selectedSeason,
    viewMode
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Statistics Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading comparison data...</div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
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

  if (statsData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Statistics Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No data available for comparison</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Head-to-Head Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Head-to-Head Comparison ({selectedSeason})
            <Badge variant="secondary" className="text-xs">
              {statsData.map(s => s.name).join(' vs ')}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Field Goal Percentage */}
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">Field Goal %</div>
              {statsData.map(entity => (
                <div key={entity.name} className="space-y-1">
                  <div className="font-semibold text-lg">
                    {(entity.stats.fieldGoalPercentage * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entity.stats.madeShots}/{entity.stats.totalShots}
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    {entity.name}
                  </div>
                </div>
              ))}
            </div>

            {/* Two Point Percentage */}
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">2PT %</div>
              {statsData.map(entity => (
                <div key={entity.name} className="space-y-1">
                  <div className="font-semibold text-lg">
                    {(entity.stats.twoPointPercentage * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entity.stats.twoPointMade}/{entity.stats.twoPointAttempted}
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    {entity.name}
                  </div>
                </div>
              ))}
            </div>

            {/* Three Point Percentage */}
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">3PT %</div>
              {statsData.map(entity => (
                <div key={entity.name} className="space-y-1">
                  <div className="font-semibold text-lg">
                    {(entity.stats.threePointPercentage * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entity.stats.threePointMade}/{entity.stats.threePointAttempted}
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    {entity.name}
                  </div>
                </div>
              ))}
            </div>

            {/* Total Shots */}
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">Total Shots</div>
              {statsData.map(entity => (
                <div key={entity.name} className="space-y-1">
                  <div className="font-semibold text-lg">
                    {entity.stats.totalShots.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">This Season</div>
                  <div className="text-xs font-medium text-foreground">
                    {entity.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zone Analysis Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {statsData.map(entity => (
          <Card key={entity.name}>
            <CardHeader>
              <CardTitle className="text-lg">
                {entity.name} - Zone Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Hottest Zone */}
                <div className="text-center p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <div className="flex items-center justify-center mb-2">
                    <Zap className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">Hottest Zone</div>
                  <div className="font-semibold text-sm text-red-600">
                    {entity.stats.hottestZone}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entity.stats.hottestZoneStats.made}/{entity.stats.hottestZoneStats.total} ({
                      (entity.stats.hottestZoneStats.percentage * 100).toFixed(1)
                    }%)
                  </div>
                </div>

                {/* Coldest Zone */}
                <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="flex items-center justify-center mb-2">
                    <TrendingDown className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">Coldest Zone</div>
                  <div className="font-semibold text-sm text-blue-600">
                    {entity.stats.coldestZone}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entity.stats.coldestZoneStats.made}/{entity.stats.coldestZoneStats.total} ({
                      (entity.stats.coldestZoneStats.percentage * 100).toFixed(1)
                    }%)
                  </div>
                </div>

                {/* Favorite Spot */}
                <div className="text-center p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <div className="flex items-center justify-center mb-2">
                    <Heart className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">Favorite Spot</div>
                  <div className="font-semibold text-sm text-amber-600">
                    {entity.stats.favoriteSpot}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entity.stats.favoriteSpotStats.made}/{entity.stats.favoriteSpotStats.total} ({
                      (entity.stats.favoriteSpotStats.percentage * 100).toFixed(1)
                    }%)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
