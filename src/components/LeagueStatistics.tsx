import { useState, useEffect } from "react";
import { StatisticsPanel } from "@/components/ui/statistics-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from '@/integrations/supabase/client';

interface LeagueStatisticsProps {
  selectedSeason: string;
}

interface ZoneStats {
  zone: string;
  made: number;
  attempted: number;
  percentage: number;
}

interface LeagueStats {
  totalShots: number;
  madeShots: number;
  fieldGoalPercentage: number;
  twoPointMade: number;
  twoPointAttempted: number;
  twoPointPercentage: number;
  threePointMade: number;
  threePointAttempted: number;
  threePointPercentage: number;
  zoneStats: ZoneStats[];
  hottestZone: string;
  coldestZone: string;
  favoriteSpot: string;
}

export function LeagueStatistics({ selectedSeason }: LeagueStatisticsProps) {
  const [stats, setStats] = useState<LeagueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  console.log('League Statistics - Using server-side calculation for season:', selectedSeason);

  useEffect(() => {
    const fetchLeagueStats = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔍 LeagueStatistics: Calling Edge Function for server-side stats calculation');
        
        const { data, error: functionError } = await supabase.functions.invoke('get-league-stats', {
          body: { season: selectedSeason }
        });
        
        if (functionError) {
          throw new Error(`Edge Function error: ${functionError.message}`);
        }
        
        if (data.error) {
          throw new Error(data.error);
        }
        
        console.log('🔍 LeagueStatistics: Received pre-calculated stats:', data);
        setStats(data);
        
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
              Computing league statistics on server...
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
          <p className="text-muted-foreground">No statistics available</p>
        </CardContent>
      </Card>
    );
  }

  // Transform server stats to match the expected format
  const transformedStats = {
    fieldGoalPercentage: stats.fieldGoalPercentage,
    twoPointPercentage: stats.twoPointPercentage,
    twoPointMade: stats.twoPointMade,
    twoPointAttempted: stats.twoPointAttempted,
    threePointPercentage: stats.threePointPercentage,
    threePointMade: stats.threePointMade,
    threePointAttempted: stats.threePointAttempted,
    totalShots: stats.totalShots,
    madeShots: stats.madeShots,
    hottestZone: stats.hottestZone,
    coldestZone: stats.coldestZone,
    favoriteSpot: stats.favoriteSpot
  };

  return (
    <StatisticsPanel 
      entityName={`NBA League (${selectedSeason})`}
      stats={transformedStats}
    />
  );
}