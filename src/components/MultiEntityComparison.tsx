import { Card } from "@/components/ui/card";
import { EntityShotChart } from "@/components/EntityShotChart";
import { MultiEntityStatisticsComparison } from "@/components/MultiEntityStatisticsComparison";

interface MultiEntityComparisonProps {
  entities: string[];
  selectedSeason: string;
  viewMode: "player" | "team" | "league";
}

export function MultiEntityComparison({ entities, selectedSeason, viewMode }: MultiEntityComparisonProps) {
  if (entities.length === 0) {
    return (
      <Card className="p-6 bg-card border-border shadow-card">
        <p className="text-muted-foreground text-center">No entities selected for comparison</p>
      </Card>
    );
  }

  if (entities.length === 1) {
    // Single entity - show regular view
    return (
      <div className="space-y-6">
        <EntityShotChart
          entityName={entities[0]}
          selectedSeason={selectedSeason}
          viewMode={viewMode}
        />
        <MultiEntityStatisticsComparison
          entities={[entities[0]]}
          selectedSeason={selectedSeason}
          viewMode={viewMode}
        />
      </div>
    );
  }

  // Multiple entities - show side-by-side comparison
  return (
    <div className="space-y-6">
      {/* Shot Charts Comparison */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {entities.map((entity) => (
          <EntityShotChart
            key={entity}
            entityName={entity}
            selectedSeason={selectedSeason}
            viewMode={viewMode}
          />
        ))}
      </div>

      {/* Statistics Comparison */}
      <MultiEntityStatisticsComparison
        entities={entities}
        selectedSeason={selectedSeason}
        viewMode={viewMode}
      />
    </div>
  );
}