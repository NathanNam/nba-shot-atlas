import { useState, useEffect } from 'react';
import { SupabaseDataService } from '@/services/supabaseDataService';

interface PlayerOption {
  id: string;
  name: string;
}

let cachedPlayers: PlayerOption[] | null = null;
let nameToIdMap: Map<string, string> | null = null;
let playersPromise: Promise<PlayerOption[]> | null = null;

async function fetchPlayers(): Promise<PlayerOption[]> {
  try {
    console.log('🔍 useAvailablePlayers: Starting to load players from Supabase...');
    const supabasePlayers = await SupabaseDataService.getPlayers();
    console.log('🔍 useAvailablePlayers: Raw Supabase players:', supabasePlayers);

    const playerOptions: PlayerOption[] = supabasePlayers.map(player => ({
      id: player.id, // Use the string id from the service
      name: player.name // Use the name from the service
    })).filter(player => player.id && player.name);

    console.log('🔍 useAvailablePlayers: Mapped player options:', playerOptions);

    // Deduplicate players by name, keeping the first occurrence
    const uniquePlayerMap = new Map<string, PlayerOption>();
    playerOptions.forEach(player => {
      if (!uniquePlayerMap.has(player.name)) {
        uniquePlayerMap.set(player.name, player);
      }
    });

    const deduplicatedPlayers = Array.from(uniquePlayerMap.values());
    console.log('🔍 useAvailablePlayers: Deduplicated players:', deduplicatedPlayers);

    const sortedPlayers = deduplicatedPlayers.sort((a, b) => a.name.localeCompare(b.name));
    console.log('🔍 useAvailablePlayers: Final sorted players:', sortedPlayers);

    cachedPlayers = sortedPlayers;
    nameToIdMap = new Map(sortedPlayers.map(p => [p.name, p.id]));
    return sortedPlayers;
  } catch (error) {
    console.error('Error loading players:', error);
    const fallback = [
      { id: "2544", name: "LeBron James" },
      { id: "201939", name: "Stephen Curry" },
      { id: "201142", name: "Kevin Durant" },
      { id: "203507", name: "Giannis Antetokounmpo" },
      { id: "1629029", name: "Luka Dončić" },
      { id: "1628369", name: "Jayson Tatum" }
    ];
    cachedPlayers = fallback;
    nameToIdMap = new Map(fallback.map(p => [p.name, p.id]));
    return fallback;
  }
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

export function useAvailablePlayers() {
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

  return {
    players,
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