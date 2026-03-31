import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173').split(',')[0].trim(),
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

const BASE_COST: Record<string, number> = {
  latency: 5,
  load: 15,
  uptime: 3,
  throughput: 10,
};

const CACHE_TTL_SECONDS: Record<string, number> = {
  uptime: 30,
  latency: 60,
  throughput: 60,
  load: 300,
};

const round2 = (value: number) => Number(value.toFixed(2));
const nowIso = () => new Date().toISOString();

const computeTokenCost = (params: { testType: string; isScheduled: boolean; batchSize: number }) => {
  const base = BASE_COST[params.testType] ?? 5;
  let adjusted = base;

  if (params.isScheduled) adjusted *= 0.8;
  if (params.batchSize >= 5) adjusted *= 0.85;

  return round2(adjusted);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      serviceUrl,
      testType,
      forceFresh = false,
      isScheduled = false,
      batchSize = 1,
    } = await req.json();

    if (!serviceUrl || !testType) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Running ${testType} test for ${serviceUrl}`);
    const estimatedTokens = computeTokenCost({
      testType,
      isScheduled: Boolean(isScheduled),
      batchSize: Number(batchSize || 1),
    });
    const cacheTtlSeconds = CACHE_TTL_SECONDS[testType] ?? 60;
    const cacheThreshold = new Date(Date.now() - cacheTtlSeconds * 1000).toISOString();

    const profileSelect = await adminClient
      .from('user_profiles')
      .select('token_balance, lifetime_tokens_used, email')
      .eq('id', user.id)
      .limit(1);

    if (profileSelect.error) {
      throw new Error(`Failed to load user profile: ${profileSelect.error.message}`);
    }

    let profile = profileSelect.data?.[0] ?? null;
    if (!profile) {
      const profileCreate = await adminClient
        .from('user_profiles')
        .upsert(
          {
            id: user.id,
            email: user.email ?? `${user.id}@local.user`,
            token_balance: 0,
            lifetime_tokens_used: 0,
          },
          { onConflict: 'id' },
        )
        .select('token_balance, lifetime_tokens_used, email')
        .limit(1);

      if (profileCreate.error) {
        throw new Error(`Failed to initialize profile: ${profileCreate.error.message}`);
      }
      profile = profileCreate.data?.[0] ?? null;
      if (!profile) {
        throw new Error('Profile initialization returned empty result');
      }
    }

    const cachedLookup = await adminClient
      .from('tests')
      .select('*')
      .eq('user_id', user.id)
      .eq('service_url', serviceUrl)
      .eq('test_type', testType)
      .eq('status', 'completed')
      .gte('created_at', cacheThreshold)
      .order('created_at', { ascending: false })
      .limit(1);

    const cachedTest = cachedLookup.data?.[0] ?? null;
    if (!forceFresh && !cachedLookup.error && cachedTest) {
      return new Response(
        JSON.stringify({
          success: true,
          data: cachedTest,
          results: {
            latency: cachedTest.latency,
            uptime: cachedTest.uptime,
            throughput: cachedTest.throughput,
            success_rate: cachedTest.success_rate,
          },
          predicted_efficiency: computePredictedEfficiency({
            latency: cachedTest.latency ?? 0,
            throughput: cachedTest.throughput ?? 0,
            availability: cachedTest.uptime ?? 0,
            reliability: cachedTest.success_rate ?? 0,
          }),
          token: {
            mode: 'cached',
            reserved: 0,
            deducted: 0,
            refunded: 0,
            balance: Number(profile.token_balance ?? 0),
          },
          cache: {
            hit: true,
            ttlSeconds: cacheTtlSeconds,
            cachedAt: cachedTest.created_at,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const currentBalance = Number(profile.token_balance ?? 0);
    const lifetimeUsedBefore = Number(profile.lifetime_tokens_used ?? 0);
    if (currentBalance < estimatedTokens) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient tokens',
          balance: currentBalance,
          required: estimatedTokens,
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reserveUpdate = await adminClient
      .from('user_profiles')
      .update({ token_balance: round2(currentBalance - estimatedTokens) })
      .eq('id', user.id)
      .gte('token_balance', estimatedTokens)
      .select('token_balance')
      .limit(1);

    if (reserveUpdate.error) {
      return new Response(
        JSON.stringify({
          error: 'Failed to reserve tokens',
          details: reserveUpdate.error.message,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reservedBalance = Number((reserveUpdate.data?.[0] as { token_balance?: number } | undefined)?.token_balance ?? 0);
    let refundedTokens = 0;
    let finalDeductedTokens = estimatedTokens;
    let runStatus: 'completed' | 'failed' = 'completed';
    let runErrorMessage: string | null = null;

    // Perform the actual test based on type
    const testResults: {
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
      runStatus = 'failed';
      runErrorMessage = error instanceof Error ? error.message : 'Unknown test failure';
    }

    const elapsedMs = Math.max(1, Date.now() - startTime);
    const timeoutMs = testType === 'load' ? 30000 : 10000;

    if (runStatus === 'failed') {
      const lowerMessage = (runErrorMessage || '').toLowerCase();
      const targetDown =
        lowerMessage.includes('fetch failed') ||
        lowerMessage.includes('name not resolved') ||
        lowerMessage.includes('connection refused') ||
        lowerMessage.includes('dns');
      const timedOut = lowerMessage.includes('timed out') || lowerMessage.includes('aborted');

      if (timedOut) {
        finalDeductedTokens = round2(Math.max(1, estimatedTokens * Math.min(1, elapsedMs / timeoutMs)));
      } else if (targetDown) {
        finalDeductedTokens = round2(estimatedTokens * 0.5);
      } else {
        finalDeductedTokens = 0;
      }

      refundedTokens = round2(Math.max(0, estimatedTokens - finalDeductedTokens));
    }

    if (refundedTokens > 0) {
      const refundTarget = round2(reservedBalance + refundedTokens);
      const refundUpdate = await adminClient
        .from('user_profiles')
        .update({ token_balance: refundTarget })
        .eq('id', user.id)
        .select('token_balance')
        .limit(1);

      if (refundUpdate.error) {
        console.error('Refund update failed', refundUpdate.error);
      }
    }

    const finalBalance = round2(reservedBalance + refundedTokens);
    const lifetimeUsedAfter = round2(lifetimeUsedBefore + finalDeductedTokens);

    const profileFinalize = await adminClient
      .from('user_profiles')
      .update({
        token_balance: finalBalance,
        lifetime_tokens_used: lifetimeUsedAfter,
      })
      .eq('id', user.id);

    if (profileFinalize.error) {
      console.error('Failed to finalize profile token counters', profileFinalize.error);
    }

    const txInsert = await adminClient.from('token_transactions').insert([
      {
        user_id: user.id,
        type: 'debit',
        amount: finalDeductedTokens,
        balance_after: finalBalance,
        description: `QoS ${testType} test`,
        endpoint: serviceUrl,
      },
      ...(refundedTokens > 0
        ? [
            {
              user_id: user.id,
              type: 'credit',
              amount: refundedTokens,
              balance_after: finalBalance,
              description: `QoS ${testType} refund`,
              endpoint: serviceUrl,
            },
          ]
        : []),
    ]);

    if (txInsert.error) {
      console.error('Token transaction logging failed', txInsert.error);
    }

    // Store test results in database
    const { data: testRecord, error: insertError } = await adminClient
      .from('tests')
      .insert({
        user_id: user.id,
        service_url: serviceUrl,
        test_type: testType,
        latency: testResults.latency,
        uptime: testResults.uptime,
        throughput: testResults.throughput,
        success_rate: testResults.success_rate,
        status: runStatus,
        error_message: runErrorMessage,
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

    const { data: matchedService } = await adminClient
      .from('web_services')
      .select('id')
      .or(`base_url.eq.${serviceUrl},docs_url.eq.${serviceUrl}`)
      .maybeSingle();

    const { error: predictionInsertError } = await adminClient
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
      const { error: serviceUpdateError } = await adminClient
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
        token: {
          mode: 'live',
          reserved: estimatedTokens,
          deducted: finalDeductedTokens,
          refunded: refundedTokens,
          balance: finalBalance,
        },
        cache: {
          hit: false,
          ttlSeconds: cacheTtlSeconds,
        },
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

