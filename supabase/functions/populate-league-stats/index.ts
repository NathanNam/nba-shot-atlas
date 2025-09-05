import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ZoneStats {
  zone: string;
  made: number;
  attempted: number;
  percentage: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { season } = await req.json()
    
    if (!season) {
      return new Response(
        JSON.stringify({ error: 'Season parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const tableName = `shots_${season}`
    
    console.log(`🔍 Populate League Stats: Computing stats for ${tableName}`)

    // Check if stats already exist
    const { data: existingStats } = await supabase
      .from('league_stats')
      .select('season')
      .eq('season', season)
      .single()

    if (existingStats) {
      console.log(`📊 Stats already exist for ${season}, skipping computation`)
      return new Response(
        JSON.stringify({ message: `Stats already exist for season ${season}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process data in batches to avoid timeout
    const batchSize = 50000
    let offset = 0
    let hasMore = true

    // Initialize counters
    let totalShots = 0
    let madeShots = 0
    let twoPointMade = 0
    let twoPointAttempted = 0
    let threePointMade = 0
    let threePointAttempted = 0
    const zoneMap = new Map<string, { made: number; total: number }>()

    // Process data in batches
    while (hasMore) {
      console.log(`🔍 Processing batch starting at offset ${offset}`)
      
      const { data: batchData, error: batchError } = await supabase
        .from(tableName)
        .select('shotResult, shotValue, xLegacy, yLegacy')
        .range(offset, offset + batchSize - 1)

      if (batchError) {
        throw new Error(`Error fetching batch: ${batchError.message}`)
      }

      if (!batchData || batchData.length === 0) {
        hasMore = false
        break
      }

      // Process this batch
      batchData.forEach((shot: any) => {
        const shotValue = parseInt(shot.shotValue) || 2
        const isMade = shot.shotResult === 'Made' || shot.shotResult === 'MADE' || shot.shotResult === '1'
        
        totalShots += 1
        
        if (isMade) {
          madeShots += 1
        }
        
        if (shotValue === 2) {
          twoPointAttempted += 1
          if (isMade) {
            twoPointMade += 1
          }
        } else if (shotValue === 3) {
          threePointAttempted += 1
          if (isMade) {
            threePointMade += 1
          }
        }

        // Process zones
        const zone = getZoneFromCoordinates(
          parseFloat(shot.xLegacy) || 0, 
          parseFloat(shot.yLegacy) || 0
        )
        const current = zoneMap.get(zone) || { made: 0, total: 0 }
        current.total++
        if (shot.shotResult === 'Made') {
          current.made++
        }
        zoneMap.set(zone, current)
      })

      offset += batchSize
      
      // If we got less than the batch size, we're done
      if (batchData.length < batchSize) {
        hasMore = false
      }
      
      console.log(`🔍 Processed ${totalShots} shots so far`)
    }

    // Convert zone map to stats array
    const zoneStats: ZoneStats[] = Array.from(zoneMap.entries())
      .map(([zone, stats]) => ({
        zone,
        made: stats.made,
        attempted: stats.total,
        percentage: stats.total > 0 ? stats.made / stats.total : 0
      }))
      .filter(z => z.attempted >= 100) // Only zones with meaningful sample size
      .sort((a, b) => b.percentage - a.percentage)

    // Find hottest and coldest zones
    const hottestZone = zoneStats[0]
    const coldestZone = zoneStats[zoneStats.length - 1]
    
    // Find most popular shooting zone
    const favoriteZone = Array.from(zoneMap.entries())
      .sort((a, b) => b[1].total - a[1].total)[0]

    // Insert computed stats into league_stats table
    const { error: insertError } = await supabase
      .from('league_stats')
      .insert({
        season,
        total_shots: totalShots,
        made_shots: madeShots,
        field_goal_percentage: totalShots > 0 ? madeShots / totalShots : 0,
        two_point_made: twoPointMade,
        two_point_attempted: twoPointAttempted,
        two_point_percentage: twoPointAttempted > 0 ? twoPointMade / twoPointAttempted : 0,
        three_point_made: threePointMade,
        three_point_attempted: threePointAttempted,
        three_point_percentage: threePointAttempted > 0 ? threePointMade / threePointAttempted : 0,
        zone_stats: zoneStats,
        hottest_zone: hottestZone ? `${hottestZone.zone} (${(hottestZone.percentage * 100).toFixed(1)}%)` : "N/A",
        coldest_zone: coldestZone ? `${coldestZone.zone} (${(coldestZone.percentage * 100).toFixed(1)}%)` : "N/A",
        favorite_spot: favoriteZone ? `${favoriteZone[0]} (${favoriteZone[1].total} shots)` : "N/A"
      })

    if (insertError) {
      throw new Error(`Error inserting stats: ${insertError.message}`)
    }

    console.log(`✅ Successfully computed and stored league stats for ${season}`)

    return new Response(
      JSON.stringify({ 
        message: `Successfully computed league stats for season ${season}`,
        totalShots,
        zonesFound: zoneStats.length
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        } 
      }
    )

  } catch (error) {
    console.error('Error in populate-league-stats:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Zone calculation function
function getZoneFromCoordinates(x: number, y: number): string {
  const distance = Math.sqrt(x * x + y * y);
  
  if (distance <= 40) {
    return "Restricted Area";
  } else if (distance <= 80) {
    return "Paint";
  } else if (distance <= 140) {
    return "Mid Range";
  } else if (y > 140) {
    if (x < -80) {
      return "Left Corner 3";
    } else if (x > 80) {
      return "Right Corner 3";
    } else {
      return "Above the Break 3";
    }
  } else {
    return "Long 2";
  }
}