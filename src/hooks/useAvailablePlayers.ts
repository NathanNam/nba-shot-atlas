import { useState, useEffect } from 'react';

export function useAvailablePlayers(season: string) {
  const [players, setPlayers] = useState<string[]>([]);
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
            "LeBron James", "Stephen Curry", "Kevin Durant", "Giannis Antetokounmpo",
            "Luka Dončić", "Jayson Tatum", "Joel Embiid", "Nikola Jokić",
            "Jimmy Butler", "Kawhi Leonard", "Paul George", "Damian Lillard",
            "Anthony Davis", "Ja Morant", "Devin Booker", "Trae Young"
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
        const playerNameIndex = headers.indexOf('playerNameI');
        
        if (playerNameIndex === -1) {
          setPlayers([]);
          return;
        }
        
        const uniquePlayers = new Set<string>();
        
        for (let i = 1; i < Math.min(lines.length, 1000); i++) { // Sample first 1000 rows for performance
          const values = lines[i].split(',');
          if (values.length > playerNameIndex && values[playerNameIndex]) {
            const playerName = values[playerNameIndex].replace(/"/g, '').trim();
            if (playerName) {
              uniquePlayers.add(playerName);
            }
          }
        }
        
        setPlayers(Array.from(uniquePlayers).sort());
      } catch (error) {
        console.error('Error loading players:', error);
        // Fallback to hardcoded players
        setPlayers([
          "LeBron James", "Stephen Curry", "Kevin Durant", "Giannis Antetokounmpo",
          "Luka Dončić", "Jayson Tatum", "Joel Embiid", "Nikola Jokić",
          "Jimmy Butler", "Kawhi Leonard", "Paul George", "Damian Lillard",
          "Anthony Davis", "Ja Morant", "Devin Booker", "Trae Young"
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadPlayers();
  }, [season]);

  return { players, loading };
}