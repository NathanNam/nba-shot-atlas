import { useShotData } from "@/hooks/useShotData";
import { ShotChart } from "@/components/ui/shot-chart";

interface LeagueShotChartProps {
  selectedSeason: string;
}

export function LeagueShotChart({ selectedSeason }: LeagueShotChartProps) {
  const { shotData, loading, error } = useShotData(selectedSeason, "", "league");
  
  console.log('League Shot Chart - Season:', selectedSeason, 'Data length:', shotData.length, 'Error:', error);

  return (
    <ShotChart
      title={`NBA League Average (${selectedSeason})`}
      data={shotData}
    />
  );
}