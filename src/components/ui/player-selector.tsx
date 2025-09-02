import { useState } from "react";
import { Check, ChevronsUpDown, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PlayerSelectorProps {
  viewMode: "player" | "team" | "league";
  selectedEntities: string[];
  onEntitiesChange: (entities: string[]) => void;
}

// Sample data - will be replaced with real NBA data
const players = [
  "LeBron James", "Stephen Curry", "Kevin Durant", "Giannis Antetokounmpo",
  "Luka Dončić", "Jayson Tatum", "Joel Embiid", "Nikola Jokić",
  "Jimmy Butler", "Kawhi Leonard", "Paul George", "Damian Lillard",
  "Anthony Davis", "Ja Morant", "Devin Booker", "Trae Young"
];

const teams = [
  "Los Angeles Lakers", "Golden State Warriors", "Boston Celtics", "Miami Heat",
  "Milwaukee Bucks", "Philadelphia 76ers", "Phoenix Suns", "Dallas Mavericks",
  "Denver Nuggets", "Los Angeles Clippers", "Brooklyn Nets", "Memphis Grizzlies",
  "Atlanta Hawks", "Portland Trail Blazers", "Utah Jazz", "Chicago Bulls"
];

export function PlayerSelector({ viewMode, selectedEntities, onEntitiesChange }: PlayerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const entities = viewMode === "player" ? players : teams;
  const maxSelections = 4;
  const isLeagueView = viewMode === "league";

  const handleSelect = (entity: string) => {
    if (selectedEntities.includes(entity)) {
      onEntitiesChange(selectedEntities.filter(item => item !== entity));
    } else if (selectedEntities.length < maxSelections) {
      onEntitiesChange([...selectedEntities, entity]);
    }
  };

  const handleRemove = (entity: string) => {
    onEntitiesChange(selectedEntities.filter(item => item !== entity));
  };

  const filteredEntities = entities.filter(entity =>
    entity.toLowerCase().includes(searchValue.toLowerCase())
  );

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
        <h3 className="text-lg font-semibold text-foreground">
          Select {viewMode === "player" ? "Players" : "Teams"}
        </h3>
        <Badge variant="secondary" className="text-xs">
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-secondary/30 border-border hover:bg-secondary/50"
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
        <PopoverContent className="w-full p-0 bg-popover border-border">
          <Command>
            <CommandInput 
              placeholder={`Search ${viewMode === "player" ? "players" : "teams"}...`}
              value={searchValue}
              onValueChange={setSearchValue}
              className="border-0 focus:ring-0"
            />
            <CommandEmpty>No {viewMode} found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {filteredEntities.map((entity) => (
                <CommandItem
                  key={entity}
                  value={entity}
                  onSelect={() => handleSelect(entity)}
                  className="cursor-pointer hover:bg-accent/20"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedEntities.includes(entity) ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                  {entity}
                  {selectedEntities.includes(entity) && (
                    <Badge variant="secondary" className="ml-auto bg-primary/20 text-primary text-xs">
                      Selected
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
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