import { useState, useEffect } from 'react';

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
        const year = season.includes('-') ? season.split('-')[0] : season;
        const csvPath = `/data/nbastatsv3_${year}_enriched_shots.csv`;
        
        const response = await fetch(csvPath);
        if (!response.ok) {
          // Fallback to hardcoded players if CSV not found
          setPlayers([
            { id: "2544", name: "LeBron James" },
            { id: "201939", name: "Stephen Curry" },
            { id: "201142", name: "Kevin Durant" },
            { id: "203507", name: "Giannis Antetokounmpo" },
            { id: "1629029", name: "Luka Dončić" },
            { id: "1628369", name: "Jayson Tatum" }
          ]);
          return;
        }
        
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
          setPlayers([]);
          return;
        }
        
        const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
        const playerIdIndex = headers.indexOf('personId');
        const playerNameIndex = headers.indexOf('playerNameI');
        
        if (playerIdIndex === -1 || playerNameIndex === -1) {
          setPlayers([]);
          return;
        }
        
        const uniquePlayers = new Map<string, string>();
        
        // Extract unique player ID -> Name pairs from CSV (much faster than API calls)
        for (let i = 1; i < Math.min(lines.length, 2000); i++) {
          const values = parseCsvLine(lines[i]);
          if (values.length > Math.max(playerIdIndex, playerNameIndex)) {
            const playerId = values[playerIdIndex]?.replace(/"/g, '').trim();
            const playerName = values[playerNameIndex]?.replace(/"/g, '').trim();
            
            if (playerId && playerName && !isNaN(Number(playerId))) {
              uniquePlayers.set(playerId, playerName);
            }
          }
        }
        
        const playersArray: PlayerOption[] = Array.from(uniquePlayers.entries()).map(([id, name]) => ({
          id,
          name
        }));
        
        setPlayers(playersArray.sort((a, b) => a.name.localeCompare(b.name)));
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
      } finally {
        setLoading(false);
      }
    };

    loadPlayers();
  }, [season]);

  return { players, loading };
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