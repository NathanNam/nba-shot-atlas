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
    threePointPercentage: number;
    hottestZone: string;
    coldestZone: string;
    favoriteSpot: string;
  };
}

export function StatisticsPanel({ entityName, stats }: StatisticsPanelProps) {
  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <Card className="p-4 sm:p-6 bg-gradient-stats border-border shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-foreground">{entityName} Statistics</h3>
        <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/30 self-start sm:self-auto">
          Season Analytics
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
        {/* Field Goal Percentage */}
        <div className="text-center p-3 sm:p-4 rounded-lg bg-secondary/30 border border-border">
          <div className="text-xl sm:text-2xl font-bold text-primary">
            {formatPercentage(stats.fieldGoalPercentage)}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">FG%</div>
          <div className="text-xs text-muted-foreground mt-1">
            {stats.madeShots}/{stats.totalShots}
          </div>
        </div>

        {/* Two Point Percentage */}
        <div className="text-center p-3 sm:p-4 rounded-lg bg-secondary/30 border border-border">
          <div className="text-xl sm:text-2xl font-bold text-nba-blue">
            {formatPercentage(stats.twoPointPercentage)}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">2PT%</div>
          <div className="flex items-center justify-center mt-1">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-nba-blue mr-1"></div>
            <span className="text-xs text-muted-foreground hidden sm:inline">Inside Arc</span>
            <span className="text-xs text-muted-foreground sm:hidden">2PT</span>
          </div>
        </div>

        {/* Three Point Percentage */}
        <div className="text-center p-3 sm:p-4 rounded-lg bg-secondary/30 border border-border">
          <div className="text-xl sm:text-2xl font-bold text-accent">
            {formatPercentage(stats.threePointPercentage)}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">3PT%</div>
          <div className="flex items-center justify-center mt-1">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-accent mr-1"></div>
            <span className="text-xs text-muted-foreground hidden sm:inline">Beyond Arc</span>
            <span className="text-xs text-muted-foreground sm:hidden">3PT</span>
          </div>
        </div>

        {/* Total Shots */}
        <div className="text-center p-3 sm:p-4 rounded-lg bg-secondary/30 border border-border col-span-2 sm:col-span-1">
          <div className="text-xl sm:text-2xl font-bold text-foreground">
            {stats.totalShots.toLocaleString()}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">Total Shots</div>
          <div className="text-xs text-muted-foreground mt-1">
            This Season
          </div>
        </div>
      </div>

      {/* Zone Analysis */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Hottest Zone */}
        <div className="p-3 sm:p-4 rounded-lg bg-heat-hot/10 border border-heat-hot/20">
          <div className="flex items-center mb-2">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-heat-hot mr-2 flex-shrink-0" />
            <span className="font-medium text-heat-hot text-sm sm:text-base">Hottest Zone</span>
          </div>
          <div className="text-base sm:text-lg font-semibold text-foreground">{stats.hottestZone}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">High efficiency</div>
        </div>

        {/* Coldest Zone */}
        <div className="p-3 sm:p-4 rounded-lg bg-heat-cold/10 border border-heat-cold/20">
          <div className="flex items-center mb-2">
            <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-heat-cold mr-2 flex-shrink-0" />
            <span className="font-medium text-heat-cold text-sm sm:text-base">Coldest Zone</span>
          </div>
          <div className="text-base sm:text-lg font-semibold text-foreground">{stats.coldestZone}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">Needs work</div>
        </div>

        {/* Favorite Spot */}
        <div className="p-3 sm:p-4 rounded-lg bg-accent/10 border border-accent/20">
          <div className="flex items-center mb-2">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-accent mr-2 flex-shrink-0" />
            <span className="font-medium text-accent text-sm sm:text-base">Favorite Spot</span>
          </div>
          <div className="text-base sm:text-lg font-semibold text-foreground">{stats.favoriteSpot}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">Most attempts</div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 sm:mt-6 pt-4 border-t border-border">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:items-center lg:justify-center gap-2 sm:gap-3 text-xs sm:text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-heat-hot mr-1.5 flex-shrink-0"></div>
            <span className="text-muted-foreground">Hot (60%+)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-heat-warm mr-1.5 flex-shrink-0"></div>
            <span className="text-muted-foreground">Warm (45-59%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-heat-neutral mr-1.5 flex-shrink-0"></div>
            <span className="text-muted-foreground">Average (35-44%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-heat-cold mr-1.5 flex-shrink-0"></div>
            <span className="text-muted-foreground">Cold (&lt;35%)</span>
          </div>
        </div>
      </div>
    </Card>
  );
}