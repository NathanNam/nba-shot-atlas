import { useState } from "react";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { PlayerSelector } from "@/components/ui/player-selector";
import { ShotChart } from "@/components/ui/shot-chart";
import { EntityShotChart } from "@/components/EntityShotChart";
import { EntityStatistics } from "@/components/EntityStatistics";
import { LeagueShotChart } from "@/components/LeagueShotChart";
import { LeagueStatistics } from "@/components/LeagueStatistics";
import { VersionMarker } from "@/components/ui/version-marker";
import { ComparisonShotChart } from "@/components/ComparisonShotChart";
import { ComparisonStatistics } from "@/components/ComparisonStatistics";
import { MultiEntityComparison } from "@/components/MultiEntityComparison";
import { EntityVsEntityComparison } from "@/components/EntityVsEntityComparison";
import { EntityVsEntityDualSeasonComparison } from "@/components/EntityVsEntityDualSeasonComparison";
import { BatchEntityVsEntityDualSeasonComparison } from "@/components/BatchEntityVsEntityDualSeasonComparison";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [selectedSeason, setSelectedSeason] = useState("2024-25");
  const [viewMode, setViewMode] = useState<"player" | "team">("player");
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [selectedSeason2, setSelectedSeason2] = useState("2023-24");
  
  
  // Cache selections for each view mode
  const [playerSelections, setPlayerSelections] = useState<string[]>(["Stephen Curry"]);
  const [teamSelections, setTeamSelections] = useState<string[]>(["GSW"]);
  
  // Get current selections based on view mode
  const selectedEntities = viewMode === "player" ? playerSelections : teamSelections;
  
  // Handle view mode changes
  const handleViewModeChange = (newViewMode: "player" | "team") => {
    setViewMode(newViewMode);
  };
  
  // Handle entity changes based on current view mode
  const handleEntitiesChange = (entities: string[]) => {
    if (viewMode === "player") {
      setPlayerSelections(entities);
    } else if (viewMode === "team") {
      setTeamSelections(entities);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <NavigationBar
        selectedSeason={selectedSeason}
        onSeasonChange={setSelectedSeason}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        isComparisonMode={isComparisonMode}
        onComparisonModeChange={setIsComparisonMode}
        selectedSeason2={selectedSeason2}
        onSeason2Change={setSelectedSeason2}
      />


      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {/* Sidebar - Entity Selector */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            <PlayerSelector
              viewMode={viewMode}
              selectedEntities={selectedEntities}
              onEntitiesChange={handleEntitiesChange}
              selectedSeason={selectedSeason}
            />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Shot Charts Grid */}
            <div className="space-y-4 sm:space-y-6">
              {isComparisonMode ? (
                // Comparison Mode - Handle multiple entities or seasons
                selectedEntities.length > 1 ? (
                  // Multi-entity comparison across seasons - show 2x2 grid layout
                  <div className="space-y-6">
                    {/* First row - Current season for all entities */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {selectedEntities.map((entity) => (
                        <EntityShotChart
                          key={`${entity}-${selectedSeason}`}
                          entityName={`${entity} (${selectedSeason})`}
                          selectedSeason={selectedSeason}
                          viewMode={viewMode}
                        />
                      ))}
                    </div>
                    {/* Second row - Comparison season for all entities */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {selectedEntities.map((entity) => (
                        <EntityShotChart
                          key={`${entity}-${selectedSeason2}`}
                          entityName={`${entity} (${selectedSeason2})`}
                          selectedSeason={selectedSeason2}
                          viewMode={viewMode}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  // Single entity across seasons
                  selectedEntities.map((entity) => (
                    <ComparisonShotChart
                      key={entity}
                      entityName={entity}
                      season1={selectedSeason}
                      season2={selectedSeason2}
                      viewMode={viewMode}
                    />
                  ))
                )
              ) : (
                // Single Season Mode (original functionality)
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {selectedEntities.map((entity) => (
                    <EntityShotChart
                      key={`${entity}-${selectedSeason}-${viewMode}`}
                      entityName={entity}
                      selectedSeason={selectedSeason}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Statistics Panels */}
            <div className="space-y-4 sm:space-y-6">
              {isComparisonMode ? (
                // Comparison Mode Statistics
                selectedEntities.length > 1 ? (
                  // Two players + comparison on: Show individual stats for each player in each season + player vs player comparisons
                  <div className="space-y-6">
                    {/* Individual player statistics for each season */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {/* Current season stats */}
                      {selectedEntities.map((entity) => (
                        <EntityStatistics
                          key={`${entity}-${selectedSeason}-${viewMode}`}
                          entityName={entity}
                          selectedSeason={selectedSeason}
                          viewMode={viewMode}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {/* Comparison season stats */}
                      {selectedEntities.map((entity) => (
                        <EntityStatistics
                          key={`${entity}-${selectedSeason2}-${viewMode}`}
                          entityName={entity}
                          selectedSeason={selectedSeason2}
                          viewMode={viewMode}
                        />
                      ))}
                    </div>
                    {/* Entity vs Entity comparisons for each season - using batch fetching for parallel requests */}
                    <BatchEntityVsEntityDualSeasonComparison
                      entity1={selectedEntities[0]}
                      entity2={selectedEntities[1]}
                      season1={selectedSeason}
                      season2={selectedSeason2}
                      viewMode={viewMode}
                    />
                  </div>
                ) : (
                  // Single entity across seasons: Show individual stats for each season + season comparison
                  <div className="space-y-6">
                    {/* Individual player statistics for each season */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      <EntityStatistics
                        key={`${selectedEntities[0]}-${selectedSeason}-${viewMode}`}
                        entityName={selectedEntities[0]}
                        selectedSeason={selectedSeason}
                        viewMode={viewMode}
                      />
                      <EntityStatistics
                        key={`${selectedEntities[0]}-${selectedSeason2}-${viewMode}`}
                        entityName={selectedEntities[0]}
                        selectedSeason={selectedSeason2}
                        viewMode={viewMode}
                      />
                    </div>
                    {/* Season comparison */}
                    <ComparisonStatistics
                      key={selectedEntities[0]}
                      entityName={selectedEntities[0]}
                      season1={selectedSeason}
                      season2={selectedSeason2}
                      viewMode={viewMode}
                    />
                  </div>
                )
              ) : (
                // Non-comparison mode
                selectedEntities.length > 1 ? (
                  // Two players + comparison off: Show individual stats for each player + player vs player comparison
                  <div className="space-y-6">
                    {/* Individual player statistics */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {selectedEntities.map((entity) => (
                        <EntityStatistics
                          key={`${entity}-${selectedSeason}-${viewMode}`}
                          entityName={entity}
                          selectedSeason={selectedSeason}
                          viewMode={viewMode}
                        />
                      ))}
                    </div>
                    {/* Entity vs Entity comparison */}
                    <EntityVsEntityComparison
                      entity1={selectedEntities[0]}
                      entity2={selectedEntities[1]}
                      season={selectedSeason}
                      viewMode={viewMode}
                    />
                  </div>
                ) : (
                  // Single Season Mode Statistics (original functionality)
                  selectedEntities.map((entity) => (
                    <EntityStatistics
                      key={`${entity}-${selectedSeason}-${viewMode}`}
                      entityName={entity}
                      selectedSeason={selectedSeason}
                      viewMode={viewMode}
                    />
                  ))
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 backdrop-blur-sm mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
              NBA Shot Analytics • Data from 2013-2014 to 2024-2025 seasons
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <span className="text-center">Built with modern web technologies</span>
              <VersionMarker version="v2.0.0" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
