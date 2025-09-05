import { useState, useEffect } from "react";
import { StatisticsPanel } from "@/components/ui/statistics-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from '@/integrations/supabase/client';

interface LeagueStatisticsProps {
  selectedSeason: string;
}

export function LeagueStatistics({ selectedSeason }: LeagueStatisticsProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  console.log('League Statistics - Loading from pre-computed stats table for season:', selectedSeason);

  useEffect(() => {
    const fetchLeagueStats = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔍 LeagueStatistics: Fetching pre-computed stats from league_stats table');
        
        // First try to get pre-computed stats
        const { data: precomputedStats, error: statsError } = await supabase
          .from('league_stats')
          .select('*')
          .eq('season', selectedSeason)
          .single();
        
        if (statsError && statsError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          throw new Error(`Error fetching pre-computed stats: ${statsError.message}`);
        }
        
        if (precomputedStats) {
          console.log('✅ LeagueStatistics: Found pre-computed stats:', precomputedStats);
          
          // Transform to expected format with safety checks
          const transformedStats = {
            fieldGoalPercentage: Number(precomputedStats.field_goal_percentage) || 0,
            twoPointPercentage: Number(precomputedStats.two_point_percentage) || 0,
            twoPointMade: Number(precomputedStats.two_point_made) || 0,
            twoPointAttempted: Number(precomputedStats.two_point_attempted) || 0,
            threePointPercentage: Number(precomputedStats.three_point_percentage) || 0,
            threePointMade: Number(precomputedStats.three_point_made) || 0,
            threePointAttempted: Number(precomputedStats.three_point_attempted) || 0,
            totalShots: Number(precomputedStats.total_shots) || 0,
            madeShots: Number(precomputedStats.made_shots) || 0,
            hottestZone: precomputedStats.hottest_zone || "N/A",
            coldestZone: precomputedStats.coldest_zone || "N/A",
            favoriteSpot: precomputedStats.favorite_spot || "N/A"
          };
          
          setStats(transformedStats);
        } else {
          // No pre-computed stats found, trigger computation
          console.log('⚠️ No pre-computed stats found, triggering computation...');
          
          const { error: computeError } = await supabase.functions.invoke('populate-league-stats', {
            body: { season: selectedSeason }
          });
          
          if (computeError) {
            throw new Error(`Error triggering stats computation: ${computeError.message}`);
          }
          
          // Retry fetching after computation
          const { data: newStats, error: retryError } = await supabase
            .from('league_stats')
            .select('*')
            .eq('season', selectedSeason)
            .single();
          
          if (retryError) {
            throw new Error(`Error fetching stats after computation: ${retryError.message}`);
          }
          
          if (newStats) {
            const transformedStats = {
              fieldGoalPercentage: Number(newStats.field_goal_percentage) || 0,
              twoPointPercentage: Number(newStats.two_point_percentage) || 0,
              twoPointMade: Number(newStats.two_point_made) || 0,
              twoPointAttempted: Number(newStats.two_point_attempted) || 0,
              threePointPercentage: Number(newStats.three_point_percentage) || 0,
              threePointMade: Number(newStats.three_point_made) || 0,
              threePointAttempted: Number(newStats.three_point_attempted) || 0,
              totalShots: Number(newStats.total_shots) || 0,
              madeShots: Number(newStats.made_shots) || 0,
              hottestZone: newStats.hottest_zone || "N/A",
              coldestZone: newStats.coldest_zone || "N/A",
              favoriteSpot: newStats.favorite_spot || "N/A"
            };
            
            setStats(transformedStats);
          }
        }
        
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
              Loading pre-computed league statistics...
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