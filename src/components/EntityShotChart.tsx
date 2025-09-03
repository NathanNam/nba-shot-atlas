import { ShotChart } from "@/components/ui/shot-chart";
import { useShotData } from "@/hooks/useShotData";

interface EntityShotChartProps {
  entityName: string;
  selectedSeason: string;
  viewMode: "player" | "team" | "league";
}

export function EntityShotChart({ entityName, selectedSeason, viewMode }: EntityShotChartProps) {
  const { shotData, loading, error } = useShotData(selectedSeason, entityName, viewMode);
  
  if (error) {
    return (
      <div className="p-6 bg-card border-border shadow-card rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-4 text-center">{entityName}</h3>
        <p className="text-destructive text-center">Error loading data: {error}</p>
      </div>
    );
  }
  
  return (
    <ShotChart
      title={entityName}
      data={loading ? undefined : shotData}
    />
  );
}