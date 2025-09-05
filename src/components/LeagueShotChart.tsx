import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShotChart } from "@/components/ui/shot-chart";

interface LeagueShotChartProps {
  selectedSeason: string;
}

export function LeagueShotChart({ selectedSeason }: LeagueShotChartProps) {
  const [shotData, setShotData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  console.log('League Shot Chart - Loading from sampled data for season:', selectedSeason);

  useEffect(() => {
    const fetchLeagueData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // For shot chart, we sample shot data for visualization performance
        // Use a reasonable sample size distributed across the season
        const { data, error: dataError } = await supabase
          .from(`shots_${selectedSeason}` as any)
          .select('xLegacy, yLegacy, shotResult, shotValue')
          .limit(15000) // Sample 15k shots for good visualization
          .order('gameId', { ascending: false }); // Get recent games first
        
        if (dataError) {
          throw new Error(`Error fetching shot data: ${dataError.message}`);
        }
        
        console.log(`League Shot Chart - Loaded ${data?.length || 0} sample shots for visualization`);
        setShotData(data || []);
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load league shot data';
        console.error('Error fetching league shot data:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueData();
  }, [selectedSeason]);

  if (loading) {
    return (
      <div className="bg-card border-border shadow-card rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
          NBA League Average ({selectedSeason})
        </h3>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="animate-pulse text-muted-foreground">Loading league shot chart...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border-border shadow-card rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
          NBA League Average ({selectedSeason})
        </h3>
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive text-center">Error loading shot chart: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <ShotChart
      title={`NBA League Average (${selectedSeason}) - Sample of ${shotData.length.toLocaleString()} shots`}
      data={shotData}
    />
  );
}