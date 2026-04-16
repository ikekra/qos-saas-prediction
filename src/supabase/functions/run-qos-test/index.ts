import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPerformanceQuotaState, logPerformanceRun, reservePerformanceRun } from "../_shared/performance-run-quota.ts";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

const corsHeaders = getCorsHeaders();

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const computePredictedEfficiency = (params: {
  latency: number;
  throughput: number | null | undefined;
  availability: number;
  reliability: number;
}) => {
  const latencyScore = clamp(100 - params.latency / 10, 0, 100);
  const hasThroughput = typeof params.throughput === 'number' && Number.isFinite(params.throughput);
  const throughputScore = hasThroughput ? clamp(Number(params.throughput), 0, 100) : null;
  const score = hasThroughput
    ? params.availability * 0.35 +
      params.reliability * 0.35 +
      latencyScore * 0.2 +
      (throughputScore ?? 0) * 0.1
    : params.availability * 0.4 +
      params.reliability * 0.35 +
      latencyScore * 0.25;

  return Number(clamp(score, 0, 100).toFixed(2));
};

const envCost = (key: string, fallback: number) => {
  const raw = Deno.env.get(key);
  const parsed = Number(raw);
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  switch (Math.round(value)) {
    case 5:
      return 50;
    case 8:
      return 60;
    case 10:
      return 70;
    case 15:
      return 100;
    case 20:
      return 120;
    case 25:
      return 150;
    default:
      return value;
  }
};

const BASE_COST: Record<string, number> = {
  latency: envCost("TOKEN_COST_LATENCY", 5),
  load: envCost("TOKEN_COST_HISTORICAL_ANALYSIS", 25),
  uptime: envCost("TOKEN_COST_UPTIME", 8),
  throughput: envCost("TOKEN_COST_THROUGHPUT", 10),
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
    return new Response(null, { headers: getCorsHeaders(req) });
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
      return jsonResponse({ error: 'Unauthorized' }, 401, req);
    }

    const {
      serviceUrl,
      testType,
      forceFresh = false,
      isScheduled = false,
      batchSize = 1,
    } = await req.json();

    if (!serviceUrl || !testType) {
      return jsonResponse({ error: 'Missing required parameters' }, 400, req);
    }

    console.log(`Running ${testType} test for ${serviceUrl}`);
    const estimatedTokens = computeTokenCost({
      testType,
      isScheduled: Boolean(isScheduled),
      batchSize: Number(batchSize || 1),
    });
    const cacheTtlSeconds = CACHE_TTL_SECONDS[testType] ?? 60;
    const cacheThreshold = new Date(Date.now() - cacheTtlSeconds * 1000).toISOString();

    const quotaPreview = await getPerformanceQuotaState(adminClient as any, user);

    const profileSelect = await adminClient
      .from('user_profiles')
      .select('token_balance, lifetime_tokens_used')
      .eq('id', user.id)
      .limit(1);

    if (profileSelect.error) {
      throw new Error(`Failed to load user profile: ${profileSelect.error.message}`);
    }

    const profile = profileSelect.data?.[0] ?? {
      token_balance: 0,
      lifetime_tokens_used: 0,
    };

    let cachedLookup: Awaited<ReturnType<typeof adminClient.from>> | null = null;
    try {
      cachedLookup = await adminClient
        .from('tests')
        .select('*')
        .eq('user_id', user.id)
        .eq('service_url', serviceUrl)
        .eq('test_type', testType)
        .eq('status', 'completed')
        .gte('created_at', cacheThreshold)
        .order('created_at', { ascending: false })
        .limit(1);
    } catch (error) {
      console.warn('Skipping cached test lookup because tests schema is unavailable:', error);
    }

    const cachedTest = cachedLookup?.data?.[0] ?? null;
    if (!forceFresh && cachedLookup && !cachedLookup.error && cachedTest) {
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
          quota: {
            plan: quotaPreview.plan,
            runLimit: quotaPreview.runLimit,
            runsUsed: quotaPreview.runsUsed,
            runsRemaining: quotaPreview.runsRemaining,
            resetDate: quotaPreview.resetDate,
            warning: quotaPreview.warning,
            exhaustedMessage: quotaPreview.exhaustedMessage,
            ctaLabel: quotaPreview.ctaLabel,
            orgId: quotaPreview.orgId,
          },
        }),
        {
          headers: getCorsHeaders(req),
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
        { status: 402, headers: getCorsHeaders(req) }
      );
    }

    const quota = await reservePerformanceRun(adminClient as any, user);

    if (quota.exhaustedMessage) {
      return new Response(
        JSON.stringify({
          error: quota.exhaustedMessage,
          quota: {
            plan: quota.plan,
            runLimit: quota.runLimit,
            runsUsed: quota.runsUsed,
            runsRemaining: quota.runsRemaining,
            resetDate: quota.resetDate,
            warning: quota.warning,
            exhaustedMessage: quota.exhaustedMessage,
            ctaLabel: quota.ctaLabel,
            orgId: quota.orgId,
          },
        }),
        { status: 429, headers: getCorsHeaders(req) }
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
      await adminClient.rpc('release_performance_test_run', {
        p_scope_type: quota.scopeType,
        p_scope_id: quota.scopeId,
      });
      return new Response(
        JSON.stringify({
          error: 'Failed to reserve tokens',
          details: reserveUpdate.error.message,
        }),
        { status: 409, headers: getCorsHeaders(req) }
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
        testResults.throughput = response.ok ? round2(1000 / Math.max(1, latency)) : 0; // req/s

        // For throughput test, enrich with a payload-size signal while keeping req/s as primary.
        if (testType === 'throughput') {
          const responseText = await response.text();
          const sizeInBytes = new TextEncoder().encode(responseText).length;
          const sizeInKB = sizeInBytes / 1024;
          const timeInSeconds = latency / 1000;
          const payloadRate = timeInSeconds > 0 ? sizeInKB / timeInSeconds : 0; // KB/s
          const reqPerSec = round2(1000 / Math.max(1, latency));
          testResults.throughput = round2((reqPerSec + clamp(payloadRate, 0, 200)) / 2);
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
        testResults.throughput = response.ok ? round2(1000 / Math.max(1, testResults.latency)) : 0;
      }

    } catch (error) {
      console.error('Test error:', error);
      testResults.uptime = 0;
      testResults.success_rate = 0;
      testResults.latency = Date.now() - startTime;
      testResults.throughput = 0;
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
    let testRecord: Record<string, unknown> | null = null;
    try {
      const { data, error: insertError } = await adminClient
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
      } else {
        testRecord = (data as Record<string, unknown> | null) ?? null;
      }
    } catch (error) {
      console.error('Test record insert skipped because tests schema is unavailable:', error);
    }

    const predictedEfficiency = computePredictedEfficiency({
      latency: testResults.latency ?? 0,
      throughput: testResults.throughput ?? 0,
      availability: testResults.uptime ?? 0,
      reliability: testResults.success_rate ?? 0,
    });

    let matchedService: { id?: string } | null = null;
    try {
      const { data } = await adminClient
        .from('web_services')
        .select('id')
        .or(`base_url.eq.${serviceUrl},docs_url.eq.${serviceUrl}`)
        .maybeSingle();
      matchedService = (data as { id?: string } | null) ?? null;
    } catch (error) {
      console.warn('Skipping service linkage because web_services schema is unavailable:', error);
    }

    try {
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
      }
    } catch (error) {
      console.warn('Skipping qos_predictions write because the schema is unavailable:', error);
    }

    if (matchedService?.id) {
      try {
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
      } catch (error) {
        console.warn('Skipping web_services update because the schema is unavailable:', error);
      }
    }

    await logPerformanceRun(adminClient as any, quota, {
      testType,
      durationMs: elapsedMs,
      status: runStatus,
      latency: testResults.latency,
      uptime: testResults.uptime,
      throughput: testResults.throughput,
      successRate: testResults.success_rate,
      errorMessage: runErrorMessage,
    });

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
        quota: {
          plan: quota.plan,
          runLimit: quota.runLimit,
          runsUsed: quota.runsUsed,
          runsRemaining: quota.runsRemaining,
          resetDate: quota.resetDate,
          warning: quota.warning,
          exhaustedMessage: quota.exhaustedMessage,
          ctaLabel: quota.ctaLabel,
          orgId: quota.orgId,
          summary: `Run ${quota.runNumber} of ${quota.runLimit} used. ${quota.runsRemaining} runs remaining this cycle.`,
        },
      }),
      {
        headers: getCorsHeaders(req),
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: getCorsHeaders(req),
      }
    );
  }
});

