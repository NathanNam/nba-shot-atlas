import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the OpenTelemetry configuration from Supabase secrets
    const otlpEndpoint = Deno.env.get('VITE_OTEL_EXPORTER_OTLP_ENDPOINT')
    const otlpBearerToken = Deno.env.get('VITE_OTEL_EXPORTER_OTLP_BEARER_TOKEN')

    console.log('OTEL Config Check:', {
      hasEndpoint: !!otlpEndpoint,
      hasToken: !!otlpBearerToken,
      endpoint: otlpEndpoint ? 'configured' : 'missing'
    })

    if (!otlpEndpoint) {
      throw new Error('VITE_OTEL_EXPORTER_OTLP_ENDPOINT not configured')
    }

    return new Response(
      JSON.stringify({
        endpoint: otlpEndpoint,
        bearerToken: otlpBearerToken || undefined,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }
})