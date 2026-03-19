import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const computePredictedEfficiency = (params: {
  latency: number;
  throughput: number;
  availability: number;
  reliability: number;
}) => {
  const latencyScore = clamp(100 - params.latency / 10, 0, 100);
  const throughputScore = clamp(params.throughput, 0, 100);
  const score =
    params.availability * 0.35 +
    params.reliability * 0.35 +
    latencyScore * 0.2 +
    throughputScore * 0.1;

  return Number(clamp(score, 0, 100).toFixed(2));
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { serviceUrl, testType } = await req.json();

    if (!serviceUrl || !testType) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Running ${testType} test for ${serviceUrl}`);

    // Perform the actual test based on type
    let testResults: {
      latency: number | null;
      uptime: number | null;
      throughput: number | null;
      success_rate: number | null;
    } = {
      latency: null,
      uptime: null,
      throughput: null,
      success_rate: null,
    };

    const startTime = Date.now();
    
    try {
      // Latency test - measure response time
      if (testType === 'latency' || testType === 'load' || testType === 'throughput') {
        const response = await fetch(serviceUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });
        
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        testResults.latency = latency;
        testResults.uptime = response.ok ? 100 : 0;
        testResults.success_rate = response.ok ? 100 : 0;

        // For throughput, estimate based on response size
        if (testType === 'throughput') {
          const responseText = await response.text();
          const sizeInBytes = new TextEncoder().encode(responseText).length;
          const sizeInKB = sizeInBytes / 1024;
          const timeInSeconds = latency / 1000;
          testResults.throughput = timeInSeconds > 0 ? sizeInKB / timeInSeconds : 0; // KB/s
        }
      }

      // Uptime check
      if (testType === 'uptime') {
        const response = await fetch(serviceUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        
        testResults.latency = Date.now() - startTime;
        testResults.uptime = response.ok ? 100 : 0;
        testResults.success_rate = response.ok ? 100 : 0;
      }

    } catch (error) {
      console.error('Test error:', error);
      testResults.uptime = 0;
      testResults.success_rate = 0;
      testResults.latency = Date.now() - startTime;
    }

    // Store test results in database
    const { data: testRecord, error: insertError } = await supabaseClient
      .from('tests')
      .insert({
        user_id: user.id,
        service_url: serviceUrl,
        test_type: testType,
        latency: testResults.latency,
        uptime: testResults.uptime,
        throughput: testResults.throughput,
        success_rate: testResults.success_rate,
        status: 'completed',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database error:', insertError);
      throw insertError;
    }

    const predictedEfficiency = computePredictedEfficiency({
      latency: testResults.latency ?? 0,
      throughput: testResults.throughput ?? 0,
      availability: testResults.uptime ?? 0,
      reliability: testResults.success_rate ?? 0,
    });

    const { data: matchedService } = await supabaseClient
      .from('web_services')
      .select('id')
      .or(`base_url.eq.${serviceUrl},docs_url.eq.${serviceUrl}`)
      .maybeSingle();

    const { error: predictionInsertError } = await supabaseClient
      .from('qos_predictions')
      .insert({
        user_id: user.id,
        service_id: matchedService?.id ?? null,
        latency: testResults.latency ?? 0,
        throughput: testResults.throughput ?? 0,
        availability: testResults.uptime ?? 0,
        reliability: testResults.success_rate ?? 0,
        response_time: testResults.latency ?? 0,
        predicted_efficiency: predictedEfficiency,
      });

    if (predictionInsertError) {
      console.error('qos_predictions insert error:', predictionInsertError);
      throw predictionInsertError;
    }

    if (matchedService?.id) {
      const { error: serviceUpdateError } = await supabaseClient
        .from('web_services')
        .update({
          avg_latency: testResults.latency ?? 0,
          availability_score: testResults.uptime ?? 0,
          reliability_score: testResults.success_rate ?? 0,
        })
        .eq('id', matchedService.id);

      if (serviceUpdateError) {
        console.error('web_services update error:', serviceUpdateError);
      }
    }

    console.log('Test completed successfully:', testRecord);

    return new Response(
      JSON.stringify({
        success: true,
        data: testRecord,
        results: testResults,
        predicted_efficiency: predictedEfficiency,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
