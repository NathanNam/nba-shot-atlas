import { useState } from "react";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { PlayerSelector } from "@/components/ui/player-selector";
import { ShotChart } from "@/components/ui/shot-chart";
import { StatisticsPanel } from "@/components/ui/statistics-panel";
import { EntityShotChart } from "@/components/EntityShotChart";

const Index = () => {
  const [selectedSeason, setSelectedSeason] = useState("2024-25");
  const [viewMode, setViewMode] = useState<"player" | "team" | "league">("player");
  const [selectedEntities, setSelectedEntities] = useState<string[]>(["Stephen Curry"]);

  // Sample statistics data - will be replaced with real data
  const sampleStats = {
    totalShots: 1247,
    madeShots: 623,
    fieldGoalPercentage: 0.499,
    twoPointPercentage: 0.567,
    threePointPercentage: 0.342,
    hottestZone: "Paint Area",
    coldestZone: "Left Corner 3",
    favoriteSpot: "Right Elbow"
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <NavigationBar
        selectedSeason={selectedSeason}
        onSeasonChange={setSelectedSeason}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Entity Selector */}
          <div className="lg:col-span-1 space-y-6">
            <PlayerSelector
              viewMode={viewMode}
              selectedEntities={selectedEntities}
              onEntitiesChange={setSelectedEntities}
              selectedSeason={selectedSeason}
            />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-8">
            {/* Shot Charts Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {viewMode === "league" ? (
                <div className="xl:col-span-2">
                  <ShotChart title="NBA League Average" />
                </div>
              ) : (
                selectedEntities.map((entity) => (
                  <EntityShotChart
                    key={entity}
                    entityName={entity}
                    selectedSeason={selectedSeason}
                    viewMode={viewMode}
                  />
                ))
              )}
            </div>

            {/* Statistics Panels */}
            <div className="space-y-6">
              {viewMode === "league" ? (
                <StatisticsPanel
                  entityName="NBA League"
                  stats={sampleStats}
                />
              ) : (
                selectedEntities.map((entity) => (
                  <StatisticsPanel
                    key={entity}
                    entityName={entity}
                    stats={sampleStats}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              NBA Shot Analytics • Data from 2004-2025 seasons
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Built with modern web technologies</span>
              <span className="px-2 py-1 bg-primary/10 text-primary rounded-md font-mono text-xs">
                v1.0.0
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
