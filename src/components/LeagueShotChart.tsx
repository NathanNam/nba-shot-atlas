import { useSupabaseShotData } from "@/hooks/useSupabaseShotData";
import { ShotChart } from "@/components/ui/shot-chart";

interface LeagueShotChartProps {
  selectedSeason: string;
}

export function LeagueShotChart({ selectedSeason }: LeagueShotChartProps) {
  // Use sampled data for better performance - 10k shots is representative
  const { shotData, loading, error } = useSupabaseShotData(selectedSeason, "", "league", 10000);
  
  console.log('League Shot Chart - Season:', selectedSeason, 'Data length:', shotData.length, 'Error:', error);
  if (loading) {
    return (
      <div className="bg-card border-border shadow-card rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
          NBA League Average ({selectedSeason})
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading league data...</div>
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