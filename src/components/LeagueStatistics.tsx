import { useState, useEffect } from "react";
import { StatisticsPanel } from "@/components/ui/statistics-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LeagueStatsService } from '@/services/leagueStatsService';

interface LeagueStatisticsProps {
  selectedSeason: string;
}

export function LeagueStatistics({ selectedSeason }: LeagueStatisticsProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchLeagueStats = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log(`📊 LeagueStatistics: Using server-side calculation for ${selectedSeason}`);
        
        // Use server-side edge function for efficient calculation
        const leagueStats = await LeagueStatsService.getLeagueStats(selectedSeason);
        
        // StatisticsPanel expects percentages as decimals (0.475 for 47.5%)
        const formattedStats = {
          fieldGoalPercentage: leagueStats.fieldGoalPercentage,
          twoPointPercentage: leagueStats.twoPointPercentage,
          twoPointMade: leagueStats.twoPointMade,
          twoPointAttempted: leagueStats.twoPointAttempted,
          threePointPercentage: leagueStats.threePointPercentage,
          threePointMade: leagueStats.threePointMade,
          threePointAttempted: leagueStats.threePointAttempted,
          totalShots: leagueStats.totalShots,
          madeShots: leagueStats.madeShots,
          hottestZone: leagueStats.hottestZone,
          coldestZone: leagueStats.coldestZone,
          favoriteSpot: leagueStats.favoriteSpot
        };
        
        console.log('📊 Server-calculated league stats:', formattedStats);
        setStats(formattedStats);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load league statistics';
        console.error('Error fetching league stats:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueStats();
  }, [selectedSeason]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>League Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center text-muted-foreground">
              Calculating league statistics on server...
            </div>
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

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>League Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No statistics available for {selectedSeason}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <StatisticsPanel 
      entityName={`NBA League (${selectedSeason})`}
      stats={stats}
    />
  );
}