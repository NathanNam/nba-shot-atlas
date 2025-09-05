import { useState, useEffect } from "react";
import { ShotChart } from "@/components/ui/shot-chart";
import { ParallelDataService } from '@/services/parallelDataService';

interface LeagueShotChartProps {
  selectedSeason: string;
}

export function LeagueShotChart({ selectedSeason }: LeagueShotChartProps) {
  const [shotData, setShotData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [totalShots, setTotalShots] = useState<number | undefined>(undefined);

  console.log('League Shot Chart - Using parallel loading for season:', selectedSeason);

  useEffect(() => {
    const fetchLeagueData = async () => {
      setLoading(true);
      setError(null);
      setProgress(0);
      setTotalShots(undefined);
      
      try {
        console.log(`🔍 LeagueShotChart: Using parallel loading for ${selectedSeason}`);
        
        // Use parallel data service to fetch all shots for visualization
        const data = await ParallelDataService.getDataParallel(
          selectedSeason,
          undefined,
          'league',
          (loaded, total) => {
            if (total) setTotalShots(total);
            setProgress(loaded);
          }
        );
        
        console.log(`League Shot Chart - Loaded ${data?.length || 0} shots for visualization`);
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
          <div className="animate-pulse text-muted-foreground">Loading league shot chart with parallel processing...</div>
          {totalShots && (
            <div className="text-sm text-center space-y-2 w-full max-w-xs">
              <div className="text-muted-foreground">
                Loaded {progress.toLocaleString()} / {totalShots.toLocaleString()} shots
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${totalShots > 0 ? (progress / totalShots) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
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
      title={`NBA League Average (${selectedSeason}) - ${shotData.length.toLocaleString()} shots`}
      data={shotData}
    />
  );
}