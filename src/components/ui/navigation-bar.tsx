import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, Trophy, TrendingUp } from "lucide-react";

interface NavigationBarProps {
  selectedSeason: string;
  onSeasonChange: (season: string) => void;
  viewMode: "player" | "team" | "league";
  onViewModeChange: (mode: "player" | "team" | "league") => void;
}

const seasons = [
  "2024-25", "2023-24", "2022-23", "2021-22", "2020-21",
  "2019-20", "2018-19", "2017-18", "2016-17", "2015-16",
  "2014-15", "2013-14", "2012-13", "2011-12", "2010-11",
  "2009-10", "2008-09", "2007-08", "2006-07", "2005-06", "2004-05"
];

export function NavigationBar({ 
  selectedSeason, 
  onSeasonChange, 
  viewMode, 
  onViewModeChange 
}: NavigationBarProps) {
  return (
    <nav className="bg-card border-b border-border shadow-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Title */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-hero rounded-lg shadow-glow">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">NBA Shot Analytics</h1>
                <p className="text-xs text-muted-foreground">Advanced Basketball Analytics</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-6">
            {/* Season Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-foreground hidden sm:block">Season:</span>
              <Select value={selectedSeason} onValueChange={onSeasonChange}>
                <SelectTrigger className="w-32 bg-secondary/50 border-border">
                  <SelectValue placeholder="Select season" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {seasons.map((season) => (
                    <SelectItem key={season} value={season} className="focus:bg-accent/20">
                      {season}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                <span className="hidden sm:inline">Player</span>
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
                <span className="hidden sm:inline">Team</span>
              </Button>
              <Button
                variant={viewMode === "league" ? "default" : "ghost"}
                size="sm"
                onClick={() => onViewModeChange("league")}
                className={`transition-all duration-200 ${
                  viewMode === "league" 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">League</span>
              </Button>
            </div>

            {/* Live Badge */}
            <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/30 animate-pulse-glow">
              <div className="w-2 h-2 bg-accent rounded-full mr-2 animate-pulse"></div>
              Live Data
            </Badge>
          </div>
        </div>
      </div>
    </nav>
  );
}