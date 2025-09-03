import { useState, useEffect } from 'react';
import { NBAApiService } from '@/services/nbaApi';

interface PlayerOption {
  id: string;
  name: string;
  isEnhanced?: boolean; // Indicates if we have the full name from NBA API
}

export function useAvailablePlayers(season: string) {
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

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
            { id: "2544", name: "LeBron James", isEnhanced: true },
            { id: "201939", name: "Stephen Curry", isEnhanced: true },
            { id: "201142", name: "Kevin Durant", isEnhanced: true },
            { id: "203507", name: "Giannis Antetokounmpo", isEnhanced: true },
            { id: "1629029", name: "Luka Dončić", isEnhanced: true },
            { id: "1628369", name: "Jayson Tatum", isEnhanced: true }
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
        
        const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
        const playerIdIndex = headers.indexOf('personId');
        const playerNameIndex = headers.indexOf('playerNameI');
        
        if (playerIdIndex === -1 || playerNameIndex === -1) {
          setPlayers([]);
          setLoading(false);
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
        
        const initialPlayers: PlayerOption[] = Array.from(uniquePlayers.entries()).map(([id, name]) => ({
          id,
          name,
          isEnhanced: false
        }));
        
        const sortedPlayers = initialPlayers.sort((a, b) => a.name.localeCompare(b.name));
        setPlayers(sortedPlayers);
        setLoading(false);
        
        // Now enhance with full names from NBA API in the background
        enhancePlayerNames(sortedPlayers);
        
      } catch (error) {
        console.error('Error loading players:', error);
        // Fallback to hardcoded players
        setPlayers([
          { id: "2544", name: "LeBron James", isEnhanced: true },
          { id: "201939", name: "Stephen Curry", isEnhanced: true },
          { id: "201142", name: "Kevin Durant", isEnhanced: true },
          { id: "203507", name: "Giannis Antetokounmpo", isEnhanced: true },
          { id: "1629029", name: "Luka Dončić", isEnhanced: true },
          { id: "1628369", name: "Jayson Tatum", isEnhanced: true }
        ]);
        setLoading(false);
      }
    };

    const enhancePlayerNames = async (initialPlayers: PlayerOption[]) => {
      setEnhancing(true);
      
      try {
        // Take the most popular players first (first 20 in the list)
        const playersToEnhance = initialPlayers.slice(0, 20);
        const playerIds = playersToEnhance.map(p => p.id);
        
        const playerInfoMap = await NBAApiService.getMultiplePlayerInfo(playerIds);
        
        setPlayers(currentPlayers => {
          const enhancedPlayers = currentPlayers.map(player => {
            const enhancedInfo = playerInfoMap.get(player.id);
            if (enhancedInfo) {
              return {
                ...player,
                name: enhancedInfo.displayName,
                isEnhanced: true
              };
            }
            return player;
          });
          
          return enhancedPlayers.sort((a, b) => a.name.localeCompare(b.name));
        });
        
      } catch (error) {
        console.warn('Failed to enhance player names:', error);
      } finally {
        setEnhancing(false);
      }
    };

    loadPlayers();
  }, [season]);

  return { 
    players, 
    loading, 
    enhancing,
    hasEnhancedNames: players.some(p => p.isEnhanced)
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