import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  hottestZone: string;
  hottestZoneStats: { made: number; total: number; percentage: number };
  coldestZone: string;
  coldestZoneStats: { made: number; total: number; percentage: number };
  favoriteSpot: string;
  favoriteSpotStats: { made: number; total: number; percentage: number };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { playerId, season } = await req.json();
    
    console.log(`📊 Calculating stats for player ${playerId} in season ${season}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Calculate basic shooting stats
    const { data: basicStats, error: basicError } = await supabase
      .from(`shots_${season}`)
      .select('shotResult, shotValue')
      .eq('personId', parseInt(playerId));

    if (basicError) {
      console.error('Error fetching basic stats:', basicError);
      throw basicError;
    }

    if (!basicStats || basicStats.length === 0) {
      console.log(`No shots found for player ${playerId} in season ${season}`);
      return new Response(
        JSON.stringify({ 
          error: `No shots found for player ${playerId} in season ${season}` 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Calculate shooting statistics
    const totalShots = basicStats.length;
    let madeShots = 0;
    let twoPointMade = 0;
    let twoPointAttempted = 0;
    let threePointMade = 0;
    let threePointAttempted = 0;

    basicStats.forEach(shot => {
      const made = shot.shotResult === 'Made' || shot.shotResult === 'MADE' || shot.shotResult === '1';
      if (made) madeShots++;

      const shotValue = Number(shot.shotValue);
      if (shotValue === 3) {
        threePointAttempted++;
        if (made) threePointMade++;
      } else if (shotValue === 2) {
        twoPointAttempted++;
        if (made) twoPointMade++;
      }
    });

    const fieldGoalPercentage = totalShots > 0 ? madeShots / totalShots : 0;
    const twoPointPercentage = twoPointAttempted > 0 ? twoPointMade / twoPointAttempted : 0;
    const threePointPercentage = threePointAttempted > 0 ? threePointMade / threePointAttempted : 0;

    console.log(`📊 Basic stats calculated: ${madeShots}/${totalShots} FG, ${threePointMade}/${threePointAttempted} 3PT`);

    // Calculate zone statistics
    const { data: zoneData, error: zoneError } = await supabase
      .from(`shots_${season}`)
      .select('shotResult, shotValue, shotDistance, xLegacy, yLegacy')
      .eq('personId', parseInt(playerId));

    if (zoneError) {
      console.error('Error fetching zone data:', zoneError);
      throw zoneError;
    }

    // Zone analysis
    const zoneStats = new Map<string, { made: number; total: number; percentage: number }>();

    zoneData?.forEach(shot => {
      const made = shot.shotResult === 'Made' || shot.shotResult === 'MADE' || shot.shotResult === '1';
      const zone = determineZone(shot);
      
      if (!zoneStats.has(zone)) {
        zoneStats.set(zone, { made: 0, total: 0, percentage: 0 });
      }
      
      const zs = zoneStats.get(zone)!;
      zs.total++;
      if (made) zs.made++;
      zs.percentage = zs.total > 0 ? zs.made / zs.total : 0;
    });

    // Find hottest, coldest, and favorite zones
    let hottestZone = "No data";
    let hottestZoneStats = { made: 0, total: 0, percentage: 0 };
    let coldestZone = "No data";
    let coldestZoneStats = { made: 0, total: 0, percentage: 0 };
    let favoriteSpot = "No data";
    let favoriteSpotStats = { made: 0, total: 0, percentage: 0 };

    let highestPercentage = 0;
    let lowestPercentage = 1;
    let mostAttempts = 0;

    zoneStats.forEach((stats, zone) => {
      // Hottest zone (minimum 3 attempts)
      if (stats.total >= 3 && stats.percentage > highestPercentage) {
        highestPercentage = stats.percentage;
        hottestZone = zone;
        hottestZoneStats = { ...stats };
      }
      
      // Coldest zone (minimum 3 attempts)
      if (stats.total >= 3 && stats.percentage < lowestPercentage) {
        lowestPercentage = stats.percentage;
        coldestZone = zone;
        coldestZoneStats = { ...stats };
      }
      
      // Favorite spot (most attempts)
      if (stats.total > mostAttempts) {
        mostAttempts = stats.total;
        favoriteSpot = zone;
        favoriteSpotStats = { ...stats };
      }
    });

    const playerStats: PlayerStats = {
      totalShots,
      madeShots,
      fieldGoalPercentage,
      twoPointMade,
      twoPointAttempted,
      twoPointPercentage,
      threePointMade,
      threePointAttempted,
      threePointPercentage,
      hottestZone,
      hottestZoneStats,
      coldestZone,
      coldestZoneStats,
      favoriteSpot,
      favoriteSpotStats
    };

    console.log(`📊 Final stats for player ${playerId}:`, {
      totalShots: playerStats.totalShots,
      threePoint: `${playerStats.threePointMade}/${playerStats.threePointAttempted}`
    });

    return new Response(
      JSON.stringify(playerStats),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-player-stats function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function determineZone(shot: any): string {
  const distance = parseFloat(shot.shotDistance) || 0;
  const x = parseFloat(shot.xLegacy) || 0;
  const y = parseFloat(shot.yLegacy) || 0;
  const shotValue = parseInt(shot.shotValue) || 2;

  if (distance <= 3) {
    return 'Restricted Area';
  } else if (distance <= 8) {
    return 'Paint';
  } else if (distance <= 16) {
    if (Math.abs(x) <= 80) {
      return 'Mid Range Center';
    } else {
      return Math.abs(x) > 150 ? 'Mid Range Wing' : 'Mid Range';
    }
  } else if (shotValue === 3) {
    if (y <= 100 && Math.abs(x) >= 220) {
      return x < 0 ? 'Left Corner 3' : 'Right Corner 3';
    } else if (Math.abs(x) <= 80) {
      return 'Above Break 3 Center';
    } else if (Math.abs(x) <= 160) {
      return x < 0 ? 'Above Break 3 Left' : 'Above Break 3 Right';
    } else {
      return x < 0 ? 'Left Wing 3' : 'Right Wing 3';
    }
  } else {
    if (Math.abs(x) <= 80) {
      return 'Long 2 Center';
    } else {
      return x < 0 ? 'Left Elbow' : 'Right Elbow';
    }
  }
}