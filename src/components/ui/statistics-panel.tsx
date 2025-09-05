import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, Zap } from "lucide-react";

interface StatisticsPanelProps {
  entityName: string;
  stats: {
    totalShots: number;
    madeShots: number;
    fieldGoalPercentage: number;
    twoPointPercentage: number;
    twoPointMade: number;
    twoPointAttempted: number;
    threePointPercentage: number;
    threePointMade: number;
    threePointAttempted: number;
    hottestZone: string;
    hottestZoneStats?: { made: number; total: number; percentage: number };
    coldestZone: string;
    coldestZoneStats?: { made: number; total: number; percentage: number };
    favoriteSpot: string;
    favoriteSpotStats?: { made: number; total: number; percentage: number };
  };
  size?: "default" | "compact";
}

export function StatisticsPanel({ entityName, stats, size = "default" }: StatisticsPanelProps) {
  // Font size classes based on size prop
  const getFontSizes = () => {
    if (size === "compact") {
      return {
        title: "text-mobile-lg sm:text-lg",
        statValue: "text-mobile-xl sm:text-xl font-semibold",
        statLabel: "text-mobile-xs sm:text-xs",
        statDetail: "text-mobile-xs",
        zoneTitle: "text-mobile-sm sm:text-sm",
        zoneValue: "text-mobile-sm sm:text-base",
        zoneDetail: "text-mobile-xs"
      };
    }
    
    return {
      title: "text-mobile-title",
      statValue: "text-mobile-xl sm:text-2xl font-bold",
      statLabel: "text-mobile-xs sm:text-sm",
      statDetail: "text-mobile-xs",
      zoneTitle: "text-mobile-sm sm:text-base",
      zoneValue: "text-mobile-base sm:text-lg",
      zoneDetail: "text-mobile-subtitle"
    };
  };

  const fontSizes = getFontSizes();
  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
  
  const formatZoneStats = (zoneStats?: { made: number; total: number; percentage: number }) => {
    if (!zoneStats || zoneStats.total === 0) return null;
    return `${zoneStats.made}/${zoneStats.total} (${formatPercentage(zoneStats.percentage)})`;
  };

  return (
    <Card className="mobile-padding bg-gradient-stats border-border shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <h3 className={`${fontSizes.title} font-semibold text-foreground`}>{entityName} Statistics</h3>
        <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/30 self-start sm:self-auto">
          Season Analytics
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 mobile-gap mb-4 sm:mb-6">
        {/* Field Goal Percentage */}
        <div className="text-center p-3 sm:p-4 rounded-lg bg-secondary/30 border border-border">
          <div className={`${fontSizes.statValue} text-primary`}>
            {formatPercentage(stats.fieldGoalPercentage)}
          </div>
          <div className={`${fontSizes.statLabel} text-muted-foreground`}>FG%</div>
          <div className={`${fontSizes.statDetail} text-muted-foreground mt-1`}>
            {stats.madeShots}/{stats.totalShots}
          </div>
        </div>

        {/* Two Point Percentage */}
        <div className="text-center p-3 sm:p-4 rounded-lg bg-secondary/30 border border-border">
          <div className={`${fontSizes.statValue} text-nba-blue`}>
            {formatPercentage(stats.twoPointPercentage)}
          </div>
          <div className={`${fontSizes.statLabel} text-muted-foreground`}>2PT%</div>
          <div className={`${fontSizes.statDetail} text-muted-foreground mt-1`}>
            {stats.twoPointMade}/{stats.twoPointAttempted}
          </div>
        </div>

        {/* Three Point Percentage */}
        <div className="text-center p-3 sm:p-4 rounded-lg bg-secondary/30 border border-border">
          <div className={`${fontSizes.statValue} text-accent`}>
            {formatPercentage(stats.threePointPercentage)}
          </div>
          <div className={`${fontSizes.statLabel} text-muted-foreground`}>3PT%</div>
          <div className={`${fontSizes.statDetail} text-muted-foreground mt-1`}>
            {stats.threePointMade}/{stats.threePointAttempted}
          </div>
        </div>

        {/* Total Shots */}
        <div className="text-center p-3 sm:p-4 rounded-lg bg-secondary/30 border border-border col-span-2 sm:col-span-1">
          <div className={`${fontSizes.statValue} text-foreground`}>
            {stats.totalShots.toLocaleString()}
          </div>
          <div className={`${fontSizes.statLabel} text-muted-foreground`}>Total Shots</div>
        </div>
      </div>

      {/* Zone Analysis */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Hottest Zone */}
        <div className="p-3 sm:p-4 rounded-lg bg-heat-hot/10 border border-heat-hot/20">
          <div className="flex items-center mb-2">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-heat-hot mr-2 flex-shrink-0" />
            <span className={`font-medium text-heat-hot ${fontSizes.zoneTitle}`}>Hottest Zone</span>
          </div>
          <div className={`${fontSizes.zoneValue} font-semibold text-foreground`}>{stats.hottestZone}</div>
          <div className={`${fontSizes.zoneDetail} text-muted-foreground`}>
            {formatZoneStats(stats.hottestZoneStats) || "High efficiency"}
          </div>
        </div>

        {/* Coldest Zone */}
        <div className="p-3 sm:p-4 rounded-lg bg-heat-cold/10 border border-heat-cold/20">
          <div className="flex items-center mb-2">
            <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-heat-cold mr-2 flex-shrink-0" />
            <span className={`font-medium text-heat-cold ${fontSizes.zoneTitle}`}>Coldest Zone</span>
          </div>
          <div className={`${fontSizes.zoneValue} font-semibold text-foreground`}>{stats.coldestZone}</div>
          <div className={`${fontSizes.zoneDetail} text-muted-foreground`}>
            {formatZoneStats(stats.coldestZoneStats) || "Needs work"}
          </div>
        </div>

        {/* Favorite Spot */}
        <div className="p-3 sm:p-4 rounded-lg bg-accent/10 border border-accent/20">
          <div className="flex items-center mb-2">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-accent mr-2 flex-shrink-0" />
            <span className={`font-medium text-accent ${fontSizes.zoneTitle}`}>Favorite Spot</span>
          </div>
          <div className={`${fontSizes.zoneValue} font-semibold text-foreground`}>{stats.favoriteSpot}</div>
          <div className={`${fontSizes.zoneDetail} text-muted-foreground`}>
            {formatZoneStats(stats.favoriteSpotStats) || "Most attempts"}
          </div>
        </div>
      </div>

    </Card>
  );
}