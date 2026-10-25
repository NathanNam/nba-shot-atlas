import { useState, useEffect, useMemo } from 'react';
import { SupabaseDataService } from '@/services/supabaseDataService';

interface PlayerOption {
  id: string;
  name: string;
  seasons: string[];
}

let cachedPlayers: PlayerOption[] | null = null;
let nameToIdMap: Map<string, string> | null = null;
let playersPromise: Promise<PlayerOption[]> | null = null;

async function fetchPlayers(): Promise<PlayerOption[]> {
  try {
    const supabasePlayers = await SupabaseDataService.getPlayers();

    const playerOptions: PlayerOption[] = supabasePlayers.map(player => ({
      id: player.id,
      name: player.name,
      seasons: player.seasons,
    })).filter(player => player.id && player.name);


    const sortedPlayers = playerOptions.sort((a, b) => a.name.localeCompare(b.name));
    cachedPlayers = sortedPlayers;
    nameToIdMap = new Map(uniqueByName(sortedPlayers).map(p => [p.name, p.id]));
    return sortedPlayers;
  } catch (error) {
    console.error('Error loading players:', error);
    // Not cached, so the next mount retries.
    return [];
  }
}

// Selections are made by name, so keep one player per name. Two different
// players share a name (Mike James, Tony Mitchell): keep the more recent one.
function uniqueByName(players: PlayerOption[]): PlayerOption[] {
  const latest = (p: PlayerOption) => p.seasons[p.seasons.length - 1] ?? '';
  const byName = new Map<string, PlayerOption>();
  for (const player of players) {
    const seen = byName.get(player.name);
    if (!seen || latest(player) > latest(seen)) byName.set(player.name, player);
  }
  return Array.from(byName.values());
}

function getPlayersOnce(): Promise<PlayerOption[]> {
  if (cachedPlayers) {
    return Promise.resolve(cachedPlayers);
  }
  if (!playersPromise) {
    playersPromise = fetchPlayers().finally(() => {
      playersPromise = null;
    });
  }
  return playersPromise;
}

/**
 * All players, or with a season only those who took a shot in that season.
 */
export function useAvailablePlayers(season?: string) {
  const [players, setPlayers] = useState<PlayerOption[]>(cachedPlayers ?? []);
  const [loading, setLoading] = useState(!cachedPlayers);

  useEffect(() => {
    let isMounted = true;
    if (!cachedPlayers) {
      setLoading(true);
      getPlayersOnce().then(fetched => {
        if (isMounted) {
          setPlayers(fetched);
          setLoading(false);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, []);

  const seasonPlayers = useMemo(
    () => uniqueByName(season ? players.filter(p => p.seasons.includes(season)) : players),
    [players, season]
  );

  return {
    players: seasonPlayers,
    loading
  };
}

export function usePlayerIdMap() {
  const [map, setMap] = useState<Map<string, string>>(nameToIdMap ?? new Map());

  useEffect(() => {
    if (!nameToIdMap) {
      getPlayersOnce().then(() => {
        setMap(new Map(nameToIdMap!));
      });
    }
  }, []);

  return map;
}

// Helper function to properly parse CSV lines with quoted values
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}