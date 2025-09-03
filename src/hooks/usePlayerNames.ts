import { useState, useEffect } from 'react';
import { NBAApiService } from '@/services/nbaApi';

interface PlayerNameMap {
  [playerId: string]: string;
}

export function usePlayerNames(playerIds: string[]) {
  const [playerNames, setPlayerNames] = useState<PlayerNameMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (playerIds.length === 0) {
      setPlayerNames({});
      return;
    }

    const fetchPlayerNames = async () => {
      setLoading(true);
      setError(null);

      try {
        const playerInfoMap = await NBAApiService.getMultiplePlayerInfo(playerIds);
        
        const nameMap: PlayerNameMap = {};
        playerInfoMap.forEach((info, playerId) => {
          nameMap[playerId] = info.displayName;
        });
        
        setPlayerNames(nameMap);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch player names';
        setError(errorMessage);
        console.error('Error fetching player names:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerNames();
  }, [playerIds.join(',')]); // Use join to create a stable dependency

  return {
    playerNames,
    loading,
    error,
    getPlayerName: (playerId: string) => playerNames[playerId] || `Player ${playerId}`
  };
}