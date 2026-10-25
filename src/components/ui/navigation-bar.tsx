import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BarChart3, Users, Trophy, TrendingUp } from "lucide-react";

interface NavigationBarProps {
  selectedSeason: string;
  onSeasonChange: (season: string) => void;
  viewMode: "player" | "team";
  onViewModeChange: (mode: "player" | "team") => void;
  isComparisonMode: boolean;
  onComparisonModeChange: (enabled: boolean) => void;
  selectedSeason2?: string;
  onSeason2Change?: (season: string) => void;
  isCareerMode: boolean;
  onCareerModeChange: (enabled: boolean) => void;
}

const seasons = [
  "2025-26", "2024-25", "2023-24", "2022-23", "2021-22", "2020-21",
  "2019-20", "2018-19", "2017-18", "2016-17", "2015-16", "2014-15", "2013-14"
];

export function NavigationBar({ 
  selectedSeason, 
  onSeasonChange, 
  viewMode, 
  onViewModeChange,
  isComparisonMode,
  onComparisonModeChange,
  selectedSeason2,
  onSeason2Change,
  isCareerMode,
  onCareerModeChange
}: NavigationBarProps) {
  return (
    <nav className="bg-card border-b border-border shadow-card">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Mobile Layout - Stacked */}
        <div className="block sm:hidden">
          <div className="flex items-center justify-between py-3">
            {/* Logo and Title - Compressed */}
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-gradient-hero rounded-lg shadow-glow">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-fluid-title text-foreground">NBA Shot Analytics</h1>
              </div>
            </div>
          </div>
          
          {/* Mobile Controls Row */}
          <div className="pb-3 space-y-3">
            {/* Season Selector Row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <Label htmlFor="career-mode-mobile" className="text-xs font-medium text-foreground">
                  Career
                </Label>
                <Switch id="career-mode-mobile" checked={isCareerMode} onCheckedChange={onCareerModeChange} />
              </div>
              {!isCareerMode && (<>
              <div className="flex items-center space-x-2 flex-1">
                <Select value={selectedSeason} onValueChange={onSeasonChange}>
                  <SelectTrigger className="w-28 bg-secondary/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {seasons.map((season) => (
                      <SelectItem key={season} value={season} className="focus:bg-accent/20">
                        {season}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {isComparisonMode && (
                  <>
                    <span className="text-xs text-muted-foreground">vs</span>
                    <Select value={selectedSeason2} onValueChange={onSeason2Change}>
                      <SelectTrigger className="w-28 bg-secondary/50 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-50">
                        {seasons.filter(s => s !== selectedSeason).map((season) => (
                          <SelectItem key={season} value={season} className="focus:bg-accent/20">
                            {season}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
              
              {/* Comparison Toggle */}
              <div className="flex items-center space-x-2">
                <Label htmlFor="comparison-mode-mobile" className="text-xs font-medium text-foreground">
                  Compare
                </Label>
                <Switch
                  id="comparison-mode-mobile"
                  checked={isComparisonMode}
                  onCheckedChange={onComparisonModeChange}
                />
              </div>
              </>)}
            </div>
            
            {/* View Mode Toggle Row */}
            <div className="flex items-center justify-center">
              <div className="flex items-center space-x-1 bg-secondary/30 rounded-lg p-1">
                <Button
                  variant={viewMode === "player" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onViewModeChange("player")}
                  className={`touch-target px-3 py-2 text-mobile-xs sm:text-xs transition-all duration-200 ${
                    viewMode === "player" 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <Users className="h-3 w-3 mr-1" />
                  Player
                </Button>
                <Button
                  variant={viewMode === "team" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onViewModeChange("team")}
                  className={`touch-target px-3 py-2 text-mobile-xs sm:text-xs transition-all duration-200 ${
                    viewMode === "team" 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <Trophy className="h-3 w-3 mr-1" />
                  Team
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Layout - Single Row */}
        <div className="hidden sm:flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-hero rounded-lg shadow-glow">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-fluid-title text-foreground">NBA Shot Analytics</h1>
                <p className="text-xs text-muted-foreground">Advanced Basketball Analytics</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-4">
            {/* Career Toggle */}
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-accent hidden lg:block" aria-hidden />
              <Label htmlFor="career-mode" className="text-sm font-medium text-foreground">
                Career
              </Label>
              <Switch id="career-mode" checked={isCareerMode} onCheckedChange={onCareerModeChange} />
            </div>

            {!isCareerMode && (<>
            {/* Season Comparison Toggle */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="comparison-mode" className="text-sm font-medium text-foreground hidden lg:block">
                Comparison:
              </Label>
              <Switch
                id="comparison-mode"
                checked={isComparisonMode}
                onCheckedChange={onComparisonModeChange}
              />
            </div>

            {/* Season Selectors */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-foreground hidden lg:block">
                {isComparisonMode ? "Seasons:" : "Season:"}
              </span>
              <div className="flex items-center space-x-2">
                <Select value={selectedSeason} onValueChange={onSeasonChange}>
                  <SelectTrigger className="w-32 bg-secondary/50 border-border">
                    <SelectValue placeholder="Select season" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border z-50">
                    {seasons.map((season) => (
                      <SelectItem key={season} value={season} className="focus:bg-accent/20">
                        {season}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {isComparisonMode && (
                  <>
                    <span className="text-muted-foreground">vs</span>
                    <Select value={selectedSeason2} onValueChange={onSeason2Change}>
                      <SelectTrigger className="w-32 bg-secondary/50 border-border">
                        <SelectValue placeholder="Compare with" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border z-50">
                        {seasons.filter(s => s !== selectedSeason).map((season) => (
                          <SelectItem key={season} value={season} className="focus:bg-accent/20">
                            {season}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </div>
            </>)}

            {/* View Mode Toggle */}
            <div className="flex items-center space-x-1 bg-secondary/30 rounded-lg p-1">
              <Button
                variant={viewMode === "player" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("player")}
                className={`transition-all duration-200 ${
                  viewMode === "player" 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Users className="h-4 w-4 mr-1" />
                <span className="hidden md:inline">Player</span>
              </Button>
              <Button
                variant={viewMode === "team" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("team")}
                className={`transition-all duration-200 ${
                  viewMode === "team" 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Trophy className="h-4 w-4 mr-1" />
                <span className="hidden md:inline">Team</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}