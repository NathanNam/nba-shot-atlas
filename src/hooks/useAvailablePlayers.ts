import { useState, useEffect } from 'react';
import { NBAApiService } from '@/services/nbaApi';

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
        
        if (playerIdIndex === -1) {
          setPlayers([]);
          return;
        }
        
        const uniquePlayerIds = new Set<string>();
        
        for (let i = 1; i < Math.min(lines.length, 1000); i++) { // Sample first 1000 rows for performance
          const values = lines[i].split(',');
          if (values.length > playerIdIndex && values[playerIdIndex]) {
            const playerId = values[playerIdIndex].replace(/"/g, '').trim();
            if (playerId && !isNaN(Number(playerId))) {
              uniquePlayerIds.add(playerId);
            }
          }
        }
        
        // Fetch player names from NBA API
        const playerIds = Array.from(uniquePlayerIds).slice(0, 50); // Limit to 50 players for performance
        const playerInfoMap = await NBAApiService.getMultiplePlayerInfo(playerIds);
        
        const playersWithNames: PlayerOption[] = [];
        playerInfoMap.forEach((info, playerId) => {
          playersWithNames.push({
            id: playerId,
            name: info.displayName
          });
        });
        
        setPlayers(playersWithNames.sort((a, b) => a.name.localeCompare(b.name)));
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