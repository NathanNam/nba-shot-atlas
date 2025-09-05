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
import { DataMigration } from "@/components/DataMigration";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [selectedSeason, setSelectedSeason] = useState("2024-25");
  const [viewMode, setViewMode] = useState<"player" | "team" | "league">("player");
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [selectedSeason2, setSelectedSeason2] = useState("2023-24");
  const [showMigration, setShowMigration] = useState(false);
  
  // Cache selections for each view mode
  const [playerSelections, setPlayerSelections] = useState<string[]>(["Stephen Curry"]);
  const [teamSelections, setTeamSelections] = useState<string[]>(["GSW"]);
  const [leagueSelections] = useState<string[]>([]); // League doesn't have selections
  
  // Get current selections based on view mode
  const selectedEntities = viewMode === "player" ? playerSelections : 
                          viewMode === "team" ? teamSelections : 
                          leagueSelections;
  
  // Handle view mode changes
  const handleViewModeChange = (newViewMode: "player" | "team" | "league") => {
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

      {/* Migration Banner */}
      {!showMigration && (
        <div className="bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-blue-600 dark:text-blue-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Ready to migrate your data to Supabase for better performance?
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    This will improve loading speeds, especially on mobile devices.
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => setShowMigration(true)}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Start Migration
                </Button>
                <Button
                  onClick={() => setShowMigration(false)}
                  variant="ghost"
                  size="sm"
                  className="text-blue-600 hover:text-blue-700"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Migration Component */}
      {showMigration && (
        <div className="bg-muted/50 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-end mb-4">
              <Button
                onClick={() => setShowMigration(false)}
                variant="outline"
                size="sm"
              >
                Hide Migration
              </Button>
            </div>
            <DataMigration />
          </div>
        </div>
      )}

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
                // Comparison Mode - Always compare across seasons
                viewMode === "league" ? (
                  <ComparisonShotChart
                    entityName="NBA League"
                    season1={selectedSeason}
                    season2={selectedSeason2}
                    viewMode={viewMode}
                  />
                ) : (
                  // Compare each selected entity across two seasons
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
                  {viewMode === "league" ? (
                    <div className="xl:col-span-2">
                      <LeagueShotChart selectedSeason={selectedSeason} />
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
              )}
            </div>

            {/* Statistics Panels */}
            <div className="space-y-4 sm:space-y-6">
              {isComparisonMode ? (
                // Comparison Mode Statistics - Always compare across seasons
                viewMode === "league" ? (
                  <ComparisonStatistics
                    entityName="NBA League"
                    season1={selectedSeason}
                    season2={selectedSeason2}
                    viewMode={viewMode}
                  />
                ) : (
                  // Compare each selected entity across two seasons
                  selectedEntities.map((entity) => (
                    <ComparisonStatistics
                      key={entity}
                      entityName={entity}
                      season1={selectedSeason}
                      season2={selectedSeason2}
                      viewMode={viewMode}
                    />
                  ))
                )
              ) : (
                // Single Season Mode Statistics (original functionality)
                viewMode === "league" ? (
                  <LeagueStatistics selectedSeason={selectedSeason} />
                ) : (
                  selectedEntities.map((entity) => (
                    <EntityStatistics
                      key={entity}
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
              <VersionMarker version="v1.2.0" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
