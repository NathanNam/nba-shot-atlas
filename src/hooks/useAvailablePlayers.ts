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
        const response = await fetch('/data/nba_players_2013_2025.csv');
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
          setLoading(false);
          return;
        }
        
        const csvText = await response.text();
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
          setPlayers([]);
          setLoading(false);
          return;
        }
        
        // Skip header line and parse all players
        const playerOptions: PlayerOption[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const [playerId, playerFullName] = line.split(',');
          if (playerId && playerFullName) {
            playerOptions.push({
              id: playerId,
              name: playerFullName
            });
          }
        }
        
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