import { useState, useEffect } from 'react';
import { SupabaseDataService } from '@/services/supabaseDataService';

interface PlayerOption {
  id: string;
  name: string;
}

export function useAvailablePlayers(season: string) {
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPlayers = async () => {
      setLoading(true);
      try {
        const supabasePlayers = await SupabaseDataService.getPlayers();
        
        const playerOptions: PlayerOption[] = supabasePlayers.map(player => ({
          id: player.personId,
          name: player.playerFullName
        }));
        
        const sortedPlayers = playerOptions.sort((a, b) => a.name.localeCompare(b.name));
        setPlayers(sortedPlayers);
        setLoading(false);
        
      } catch (error) {
        console.error('Error loading players:', error);
        // Fallback to hardcoded players
        setPlayers([
          { id: "2544", name: "LeBron James" },
          { id: "201939", name: "Stephen Curry" },
          { id: "201142", name: "Kevin Durant" },
          { id: "203507", name: "Giannis Antetokounmpo" },
          { id: "1629029", name: "Luka Dončić" },
          { id: "1628369", name: "Jayson Tatum" }
        ]);
        setLoading(false);
      }
    };

    loadPlayers();
  }, [season]);

  return { 
    players, 
    loading
  };
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