import { useState, useEffect } from "react";
import { StatisticsPanel } from "@/components/ui/statistics-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from '@/integrations/supabase/client';

interface LeagueStatisticsProps {
  selectedSeason: string;
}

interface ShotData {
  shotResult: string;
  shotValue: number;
  xLegacy: string;
  yLegacy: string;
}

export function LeagueStatistics({ selectedSeason }: LeagueStatisticsProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  console.log('League Statistics - Calculating directly from shots table for season:', selectedSeason);

  // Helper function to determine zone from coordinates
  const getZoneFromCoordinates = (x: number, y: number): string => {
    const distance = Math.sqrt(x * x + y * y);
    
    if (distance <= 40) return "Restricted Area";
    if (distance <= 80) return "Paint";
    if (y > 142) return "Deep 3";
    if (distance > 238) return "Long 3";
    if (distance > 200) return "3-Point";
    return "Mid-Range";
  };

  useEffect(() => {
    const fetchLeagueStats = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log(`🔍 LeagueStatistics: Calculating stats directly from shots_${selectedSeason} table`);
        
        // Fetch all shots for the season
        const { data: shotData, error: shotError } = await supabase
          .from(`shots_${selectedSeason}` as any)
          .select('shotResult, shotValue, xLegacy, yLegacy') as any;
        
        if (shotError) {
          throw new Error(`Error fetching shot data: ${shotError.message}`);
        }
        
        if (!shotData || shotData.length === 0) {
          throw new Error(`No shot data found for season ${selectedSeason}`);
        }
        
        console.log(`📊 Processing ${shotData.length} shots for league statistics`);
        
        // Calculate statistics
        let totalShots = shotData.length;
        let madeShots = 0;
        let twoPointMade = 0;
        let twoPointAttempted = 0;
        let threePointMade = 0;
        let threePointAttempted = 0;
        
        // Zone tracking
        const zoneStats: { [key: string]: { made: number; attempted: number } } = {};
        
        (shotData as ShotData[]).forEach(shot => {
          const isMade = shot.shotResult === 'Made' || shot.shotResult === 'made';
          const shotValue = typeof shot.shotValue === 'number' ? shot.shotValue : parseInt(String(shot.shotValue) || '2');
          
          if (isMade) madeShots++;
          
          if (shotValue === 2) {
            twoPointAttempted++;
            if (isMade) twoPointMade++;
          } else if (shotValue === 3) {
            threePointAttempted++;
            if (isMade) threePointMade++;
          }
          
          // Zone calculation (simplified)
          const zone = getZoneFromCoordinates(parseFloat(shot.xLegacy) || 0, parseFloat(shot.yLegacy) || 0);
          if (!zoneStats[zone]) {
            zoneStats[zone] = { made: 0, attempted: 0 };
          }
          zoneStats[zone].attempted++;
          if (isMade) zoneStats[zone].made++;
        });
        
        // Calculate percentages
        const fieldGoalPercentage = totalShots > 0 ? (madeShots / totalShots) * 100 : 0;
        const twoPointPercentage = twoPointAttempted > 0 ? (twoPointMade / twoPointAttempted) * 100 : 0;
        const threePointPercentage = threePointAttempted > 0 ? (threePointMade / threePointAttempted) * 100 : 0;
        
        // Find hottest and coldest zones
        let hottestZone = "N/A";
        let coldestZone = "N/A";
        let highestPercentage = 0;
        let lowestPercentage = 100;
        
        Object.entries(zoneStats).forEach(([zone, stats]) => {
          if (stats.attempted >= 100) { // Minimum threshold
            const percentage = (stats.made / stats.attempted) * 100;
            if (percentage > highestPercentage) {
              highestPercentage = percentage;
              hottestZone = `${zone} (${percentage.toFixed(1)}%)`;
            }
            if (percentage < lowestPercentage) {
              lowestPercentage = percentage;
              coldestZone = `${zone} (${percentage.toFixed(1)}%)`;
            }
          }
        });
        
        // Find favorite spot (most shots)
        let favoriteSpot = "N/A";
        let maxShots = 0;
        Object.entries(zoneStats).forEach(([zone, stats]) => {
          if (stats.attempted > maxShots) {
            maxShots = stats.attempted;
            favoriteSpot = `${zone} (${stats.attempted.toLocaleString()} shots)`;
          }
        });
        
        const calculatedStats = {
          fieldGoalPercentage,
          twoPointPercentage,
          twoPointMade,
          twoPointAttempted,
          threePointPercentage,
          threePointMade,
          threePointAttempted,
          totalShots,
          madeShots,
          hottestZone,
          coldestZone,
          favoriteSpot
        };
        
        console.log('📊 Calculated league stats:', calculatedStats);
        setStats(calculatedStats);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load league statistics';
        console.error('Error calculating league stats:', err);
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
              Calculating league statistics from shot data...
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