// NBA.com API service for fetching player information
interface PlayerInfo {
  playerId: string;
  displayName: string;
}

interface NBAApiResponse {
  resultSets: Array<{
    name: string;
    headers: string[];
    rowSet: any[][];
  }>;
}

export class NBAApiService {
  private static cache = new Map<string, PlayerInfo>();
  private static readonly BASE_URL = 'https://stats.nba.com/stats';
  
  // Headers required by NBA.com API
  private static readonly HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Host': 'stats.nba.com',
    'Origin': 'https://www.nba.com',
    'Referer': 'https://www.nba.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true'
  };

  static async getPlayerInfo(playerId: string): Promise<PlayerInfo | null> {
    // Check cache first
    if (this.cache.has(playerId)) {
      return this.cache.get(playerId)!;
    }

    try {
      const url = `${this.BASE_URL}/commonplayerinfo?PlayerID=${playerId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.HEADERS,
        mode: 'cors'
      });

      if (!response.ok) {
        console.warn(`Failed to fetch player info for ID ${playerId}: ${response.status}`);
        return null;
      }

      const data: NBAApiResponse = await response.json();
      
      // Find the CommonPlayerInfo result set
      const playerInfoSet = data.resultSets.find(rs => rs.name === 'CommonPlayerInfo');
      if (!playerInfoSet || playerInfoSet.rowSet.length === 0) {
        console.warn(`No player info found for ID ${playerId}`);
        return null;
      }

      // Extract player name from the first row
      const headers = playerInfoSet.headers;
      const row = playerInfoSet.rowSet[0];
      
      const displayNameIndex = headers.indexOf('DISPLAY_FIRST_LAST');
      if (displayNameIndex === -1) {
        console.warn(`DISPLAY_FIRST_LAST not found in response for player ID ${playerId}`);
        return null;
      }

      const displayName = row[displayNameIndex];
      if (!displayName) {
        console.warn(`Empty display name for player ID ${playerId}`);
        return null;
      }

      const playerInfo: PlayerInfo = {
        playerId,
        displayName
      };

      // Cache the result
      this.cache.set(playerId, playerInfo);
      
      return playerInfo;
    } catch (error) {
      console.error(`Error fetching player info for ID ${playerId}:`, error);
      return null;
    }
  }

  static async getMultiplePlayerInfo(playerIds: string[]): Promise<Map<string, PlayerInfo>> {
    const results = new Map<string, PlayerInfo>();
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < playerIds.length; i += batchSize) {
      const batch = playerIds.slice(i, i + batchSize);
      
      const promises = batch.map(async (playerId) => {
        const info = await this.getPlayerInfo(playerId);
        if (info) {
          results.set(playerId, info);
        }
        
        // Add delay between requests to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
      });
      
      await Promise.allSettled(promises);
      
      // Add delay between batches
      if (i + batchSize < playerIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }

  static clearCache(): void {
    this.cache.clear();
  }
}