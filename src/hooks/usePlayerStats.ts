import { useState, useEffect } from 'react';

interface PlayerStats {
  totalShots: number;
  madeShots: number;
  fieldGoalPercentage: number;
  twoPointMade: number;
  twoPointAttempted: number;
  twoPointPercentage: number;
  threePointMade: number;
  threePointAttempted: number;
  threePointPercentage: number;
}

interface ZoneStats {
  made: number;
  total: number;
  percentage: number;
}

interface ZoneAnalysis {
  hottestZone: string;
  hottestZoneStats: ZoneStats;
  coldestZone: string;
  coldestZoneStats: ZoneStats;
  favoriteSpot: string;
  favoriteSpotStats: ZoneStats;
}

export interface FullPlayerStats extends PlayerStats, ZoneAnalysis {}

/**
 * Fetch shooting statistics from a Supabase edge function so that all heavy
 * calculations run on the server instead of the client.
 */
export function usePlayerStats(playerId: string, season: string) {
  const [stats, setStats] = useState<FullPlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      if (!playerId || !season) {
        setLoading(false);
        setStats(null);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `https://icfqngdeohzzjvzcmawo.supabase.co/functions/v1/get-player-stats`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZnFuZ2Rlb2h6emp2emNtYXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjY3NTgsImV4cCI6MjA3MjYwMjc1OH0.NQfIrtGzH60IwDJ0VJEq4XyLq36HHI2y9CyWZ9aLmNE`,
              'apikey': `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZnFuZ2Rlb2h6emp2emNtYXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwMjY3NTgsImV4cCI6MjA3MjYwMjc1OH0.NQfIrtGzH60IwDJ0VJEq4XyLq36HHI2y9CyWZ9aLmNE`,
            },
            body: JSON.stringify({ playerId, season })
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Edge function error: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        const playerStats = await response.json();
        setStats(playerStats);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch stats';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [playerId, season]);

  return { stats, loading, error };
}

