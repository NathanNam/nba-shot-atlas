import { supabase } from '@/integrations/supabase/client';

export interface LeagueStats {
  totalShots: number;
  madeShots: number;
  fieldGoalPercentage: number;
  twoPointMade: number;
  twoPointAttempted: number;
  twoPointPercentage: number;
  threePointMade: number;
  threePointAttempted: number;
  threePointPercentage: number;
  hottestZone: string;
  coldestZone: string;
  favoriteSpot: string;
}

export class LeagueStatsService {
  /**
   * Get pre-computed league statistics from Edge Function
   */
  static async getLeagueStats(season: string): Promise<LeagueStats> {
    try {
      console.log(`📊 LeagueStatsService: Fetching stats for ${season}`);
      
      const response = await fetch('https://icfqngdeohzzjvzcmawo.supabase.co/functions/v1/get-league-stats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZnFuZ2Rlb2h6emp2emNtYXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjY3NTgsImV4cCI6MjA3MjYwMjc1OH0.NQfIrtGzH60IwDJ0VJEq4XyLq36HHI2y9CyWZ9aLmNE`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ season }),
      });

      if (!response.ok) {
        throw new Error(`Edge function error: ${response.status}`);
      }

      const stats = await response.json();
      console.log(`📊 LeagueStatsService: Got league stats:`, stats);
      
      // Add zone analysis (simplified for performance)
      return {
        ...stats,
        hottestZone: "Restricted Area", // Placeholder - could be computed server-side
        coldestZone: "Deep 3",
        favoriteSpot: "Paint"
      };
    } catch (error) {
      console.error('Error fetching league stats:', error);
      // Return fallback stats
      return this.getFallbackStats();
    }
  }

  /**
   * Fallback stats when Edge Function fails
   */
  private static getFallbackStats(): LeagueStats {
    return {
      totalShots: 0,
      madeShots: 0,
      fieldGoalPercentage: 0,
      twoPointMade: 0,
      twoPointAttempted: 0,
      twoPointPercentage: 0,
      threePointMade: 0,
      threePointAttempted: 0,
      threePointPercentage: 0,
      hottestZone: "No data",
      coldestZone: "No data",
      favoriteSpot: "No data"
    };
  }
}