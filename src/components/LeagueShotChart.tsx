import { useSupabaseShotData } from "@/hooks/useSupabaseShotData";
import { ShotChart } from "@/components/ui/shot-chart";

interface LeagueShotChartProps {
  selectedSeason: string;
}

export function LeagueShotChart({ selectedSeason }: LeagueShotChartProps) {
  // Use full dataset with progressive loading
  const { shotData, loading, error, progress } = useSupabaseShotData(selectedSeason, "", "league");
  
  console.log('League Shot Chart - Season:', selectedSeason, 'Data length:', shotData.length, 'Loading:', loading, 'Error:', error, 'Progress:', progress);
  if (loading && shotData.length === 0) {
    const progressText = progress 
      ? `Loading: ${progress.loaded.toLocaleString()}${progress.total ? ` / ${progress.total.toLocaleString()}` : ''} shots`
      : 'Loading league data...';
      
    return (
      <div className="bg-card border-border shadow-card rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
          NBA League Average ({selectedSeason})
        </h3>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <div className="animate-pulse text-muted-foreground">{progressText}</div>
          {progress && progress.total && (
            <div className="w-64 bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${(progress.loaded / progress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {progress && shotData.length > 0 && (
        <div className="mb-2 text-xs text-muted-foreground">
          Loading additional data: {progress.loaded.toLocaleString()} shots loaded
        </div>
      )}
      <ShotChart
        title={`NBA League Average (${selectedSeason}) - ${shotData.length.toLocaleString()} total shots`}
        data={shotData}
      />
    </div>
  );
}