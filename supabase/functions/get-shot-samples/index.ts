import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { season, sampleSize = 5000, entityId, viewMode } = await req.json()
    
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
    
    console.log(`🔍 Edge Function: Getting ${sampleSize} shot samples for ${tableName}`)

    // Build query with sampling
    let query = supabase
      .from(tableName)
      .select(`
        personId,
        teamTricode,
        xLegacy,
        yLegacy,
        shotDistance,
        shotResult,
        shotValue,
        description,
        subType
      `)

    // Apply filters based on view mode
    if (viewMode === 'player' && entityId) {
      const numericEntityId = parseInt(entityId)
      if (!isNaN(numericEntityId)) {
        query = query.eq('personId', numericEntityId)
      }
    } else if (viewMode === 'team' && entityId) {
      query = query.eq('teamTricode', entityId)
    }

    // For league mode, use systematic sampling to get representative data
    if (viewMode === 'league') {
      // Use modulo sampling for even distribution
      query = query.or(`mod(personId, 50).eq.0,mod(personId, 50).eq.25`)
    }

    // Limit to sample size
    query = query.limit(sampleSize)

    const { data, error } = await query

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    console.log(`🔍 Edge Function: Retrieved ${data?.length || 0} shot samples`)

    // Transform data to match expected format
    const shots = (data || []).map(row => ({
      personId: row.personId?.toString() || '',
      teamTricode: row.teamTricode || '',
      xLegacy: parseFloat(row.xLegacy?.toString() || '0'),
      yLegacy: parseFloat(row.yLegacy?.toString() || '0'),
      shotDistance: parseFloat(row.shotDistance?.toString() || '0'),
      shotResult: row.shotResult || '',
      shotValue: parseInt(row.shotValue?.toString() || '2'),
      description: row.description || '',
      subType: row.subType || '',
    }))

    return new Response(
      JSON.stringify({ 
        shots, 
        sampleSize: shots.length,
        isSample: viewMode === 'league' && shots.length < 50000
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=1800' // Cache for 30 minutes
        } 
      }
    )

  } catch (error) {
    console.error('Error in get-shot-samples:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})