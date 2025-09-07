import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAvailablePlayers } from "@/hooks/useAvailablePlayers";
import { useNBAAnalyticsTracking, useComponentPerformance, useUserActionTracking } from "@/hooks";

interface PlayerSelectorProps {
  viewMode: "player" | "team" | "league";
  selectedEntities: string[];
  onEntitiesChange: (entities: string[]) => void;
  selectedSeason: string;
}

interface PlayerOption {
  id: string;
  name: string;
}

const teams = [
  "ATL", "BOS", "CHA", "CHI", "CLE", "DAL", "DEN", "DET", "GSW", "HOU",
  "IND", "LAC", "LAL", "MEM", "MIA", "MIL", "MIN", "NOP", "NYK", "OKC",
  "ORL", "PHI", "PHX", "POR", "SAC", "SAS", "TOR", "UTA", "WAS"
];

export function PlayerSelector({ viewMode, selectedEntities, onEntitiesChange, selectedSeason }: PlayerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  
  // OpenTelemetry tracking hooks
  const { trackPlayerSelection, trackTeamSelection, trackViewModeChange } = useNBAAnalyticsTracking();
  const { metrics, recordCustomMetric } = useComponentPerformance('PlayerSelector');
  const { trackAction, trackFeatureUsage } = useUserActionTracking();
  
  // Always call hook but only use results in player mode
  console.log(`🔍 PlayerSelector: viewMode=${viewMode}, calling useAvailablePlayers`);
  const { players: rawPlayers, loading: rawLoading } = useAvailablePlayers();
  
  // Only use player data in player mode
  const players = viewMode === "player" ? rawPlayers : [];
  const loading = viewMode === "player" ? rawLoading : false;
  
  console.log(`🔍 PlayerSelector: players=${players?.length || 0}, loading=${loading}`);
  const entities = viewMode === "player" ? (players || []).map(p => p.name) : teams;
  const entityOptions = viewMode === "player" ? (players || []) : teams.map(t => ({ id: t, name: t }));
  const maxSelections = 2;
  const isLeagueView = viewMode === "league";

  const handleSelect = (entityName: string) => {
    const startTime = Date.now();
    
    if (selectedEntities.includes(entityName)) {
      onEntitiesChange(selectedEntities.filter(item => item !== entityName));
      trackAction('entity_deselected', {
        entity_name: entityName,
        entity_type: viewMode,
        season: selectedSeason,
        selection_count: selectedEntities.length - 1,
      });
    } else if (selectedEntities.length < maxSelections) {
      onEntitiesChange([...selectedEntities, entityName]);
      
      // Track specific entity selection
      if (viewMode === 'player') {
        trackPlayerSelection(entityName, entityName, selectedSeason);
      } else if (viewMode === 'team') {
        trackTeamSelection(entityName, entityName, selectedSeason);
      }
      
      trackAction('entity_selected', {
        entity_name: entityName,
        entity_type: viewMode,
        season: selectedSeason,
        selection_count: selectedEntities.length + 1,
        selection_time_ms: Date.now() - startTime,
      });
    } else {
      trackAction('max_selections_reached', {
        entity_type: viewMode,
        max_selections: maxSelections,
        attempted_entity: entityName,
      });
    }
    
    recordCustomMetric('selection_interaction_time', Date.now() - startTime, {
      action: 'select',
      entity_type: viewMode,
    });
    
    setOpen(false);
  };

  const handleRemove = (entityName: string) => {
    const startTime = Date.now();
    onEntitiesChange(selectedEntities.filter(item => item !== entityName));
    
    trackAction('entity_removed', {
      entity_name: entityName,
      entity_type: viewMode,
      season: selectedSeason,
      remaining_count: selectedEntities.length - 1,
    });
    
    recordCustomMetric('selection_interaction_time', Date.now() - startTime, {
      action: 'remove',
      entity_type: viewMode,
    });
  };

  const filteredEntities = (entities || []).filter(entity =>
    entity.toLowerCase().includes(searchValue.toLowerCase())
  );
  console.log(`🔍 PlayerSelector: filteredEntities length=${filteredEntities.length}`);

  // Track search functionality
  useEffect(() => {
    if (searchValue.length > 0) {
      const searchTime = 500; // Debounce time simulation
      recordCustomMetric('search_performed', searchTime, {
        query_length: searchValue.length.toString(),
        results_count: filteredEntities.length.toString(),
        entity_type: viewMode,
      });
      
      trackFeatureUsage('entity_search', {
        query: searchValue.substring(0, 10), // Limit PII
        results_count: filteredEntities.length,
        entity_type: viewMode,
      });
    }
  }, [searchValue, filteredEntities.length, viewMode, recordCustomMetric, trackFeatureUsage]);

  // Track popover interactions
  const handlePopoverOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    
    if (isOpen) {
      trackFeatureUsage('entity_selector_opened', {
        entity_type: viewMode,
        current_selections: selectedEntities.length,
        available_entities: entities.length,
      });
    }
  };

  if (isLeagueView) {
    return (
      <Card className="p-4 bg-secondary/30 border-border">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">League Overview</h3>
          <p className="text-sm text-muted-foreground">
            Displaying aggregate statistics for the entire NBA
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-mobile-title">
          Select {viewMode === "player" ? "Players" : "Teams"}
        </h3>
        <Badge variant="secondary" className="text-mobile-xs sm:text-xs">
          {selectedEntities.length}/{maxSelections} selected
        </Badge>
      </div>

      {/* Selected Entities */}
      {selectedEntities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedEntities.map((entity) => (
            <Badge
              key={entity}
              variant="secondary"
              className="px-3 py-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors"
            >
              {entity}
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-4 w-4 p-0 hover:bg-destructive/20"
                onClick={() => handleRemove(entity)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Entity Selector */}
      <Popover open={open} onOpenChange={handlePopoverOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="touch-target w-full justify-between bg-secondary/30 border-border hover:bg-secondary/50"
            disabled={selectedEntities.length >= maxSelections}
          >
            <div className="flex items-center">
              <Search className="h-4 w-4 mr-2 text-muted-foreground" />
              {selectedEntities.length === 0
                ? `Select ${viewMode === "player" ? "players" : "teams"}...`
                : `Add another ${viewMode}...`}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 bg-popover border-border z-50" sideOffset={4}>
          <Command>
            <CommandInput 
              placeholder={`Search ${viewMode === "player" ? "players" : "teams"}...`}
              value={searchValue}
              onValueChange={setSearchValue}
              className="border-0 focus:ring-0"
            />
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">Loading players...</div>
            ) : (
              <>
                <CommandEmpty>No {viewMode} found.</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {filteredEntities.map((entityName) => (
                    <CommandItem
                      key={entityName}
                      value={entityName}
                      onSelect={() => handleSelect(entityName)}
                      className="cursor-pointer hover:bg-accent/20"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedEntities.includes(entityName) ? "opacity-100 text-primary" : "opacity-0"
                        )}
                      />
                      {entityName}
                      {selectedEntities.includes(entityName) && (
                        <Badge variant="secondary" className="ml-auto bg-primary/20 text-primary text-xs">
                          Selected
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </Command>
        </PopoverContent>
      </Popover>

      {selectedEntities.length >= maxSelections && (
        <div className="text-sm text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          Maximum of {maxSelections} {viewMode === "player" ? "players" : "teams"} can be compared at once.
        </div>
      )}
    </div>
  );
}