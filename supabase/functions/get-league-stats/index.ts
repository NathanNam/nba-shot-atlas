import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeagueStats {
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
    
    console.log(`🔍 Edge Function: Computing league stats for ${tableName}`)

    // Use SQL aggregation for maximum performance
    const { data, error } = await supabase
      .from(tableName)
      .select(`
        shotResult,
        shotValue,
        count(*)
      `, { count: 'exact' })
      .group('shotResult, shotValue')

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    // Aggregate the results
    let totalShots = 0
    let madeShots = 0
    let twoPointMade = 0
    let twoPointAttempted = 0
    let threePointMade = 0
    let threePointAttempted = 0

    data.forEach((row: any) => {
      const count = parseInt(row.count) || 0
      const shotValue = parseInt(row.shotValue) || 2
      const isMade = row.shotResult === 'Made' || row.shotResult === 'MADE' || row.shotResult === '1'
      
      totalShots += count
      
      if (isMade) {
        madeShots += count
      }
      
      if (shotValue === 2) {
        twoPointAttempted += count
        if (isMade) {
          twoPointMade += count
        }
      } else if (shotValue === 3) {
        threePointAttempted += count
        if (isMade) {
          threePointMade += count
        }
      }
    })

    const stats: LeagueStats = {
      totalShots,
      madeShots,
      fieldGoalPercentage: totalShots > 0 ? madeShots / totalShots : 0,
      twoPointMade,
      twoPointAttempted,
      twoPointPercentage: twoPointAttempted > 0 ? twoPointMade / twoPointAttempted : 0,
      threePointMade,
      threePointAttempted,
      threePointPercentage: threePointAttempted > 0 ? threePointMade / threePointAttempted : 0,
    }

    console.log(`🔍 Edge Function: Computed stats:`, stats)

    return new Response(
      JSON.stringify(stats),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
        } 
      }
    )

  } catch (error) {
    console.error('Error in get-league-stats:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})