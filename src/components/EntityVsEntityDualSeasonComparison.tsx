import { EntityVsEntityComparison } from "./EntityVsEntityComparison";

interface EntityVsEntityDualSeasonComparisonProps {
  entity1: string;
  entity2: string;
  season1: string;
  season2: string;
  viewMode: "player" | "team";
}

export function EntityVsEntityDualSeasonComparison({ 
  entity1, 
  entity2, 
  season1, 
  season2, 
  viewMode 
}: EntityVsEntityDualSeasonComparisonProps) {
  return (
    <div className="space-y-8">
      <EntityVsEntityComparison
        entity1={entity1}
        entity2={entity2}
        season={season1}
        viewMode={viewMode}
      />
      <EntityVsEntityComparison
        entity1={entity1}
        entity2={entity2}
        season={season2}
        viewMode={viewMode}
      />
    </div>
  );
}