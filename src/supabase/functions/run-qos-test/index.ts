import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPerformanceQuotaState, logPerformanceRun, reservePerformanceRun } from "../_shared/performance-run-quota.ts";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

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

const VALID_TEST_TYPES = new Set(["latency", "load", "uptime", "throughput"]);

const round2 = (value: number) => Number(value.toFixed(2));

const computeTokenCost = (params: { testType: string; isScheduled: boolean; batchSize: number }) => {
  const base = BASE_COST[params.testType] ?? 5;
  let adjusted = base;

  if (params.isScheduled) adjusted *= 0.8;
  if (params.batchSize >= 5) adjusted *= 0.85;

  return round2(adjusted);
};

const buildQuotaPayload = (quota: Awaited<ReturnType<typeof reservePerformanceRun>> | Awaited<ReturnType<typeof getPerformanceQuotaState>>) => ({
  plan: quota.plan,
  runLimit: quota.runLimit,
  runsUsed: quota.runsUsed,
  runsRemaining: quota.runsRemaining,
  resetDate: quota.resetDate,
  warning: quota.warning,
  exhaustedMessage: quota.exhaustedMessage,
  ctaLabel: quota.ctaLabel,
  orgId: quota.orgId,
});

const rollbackReservedResources = async (params: {
  adminClient: ReturnType<typeof createClient>;
  userId: string;
  originalBalance: number;
  originalLifetimeUsed: number;
  quota?: { scopeType: string; scopeId: string } | null;
}) => {
  const profileRollback = await params.adminClient
    .from("user_profiles")
    .update({
      token_balance: params.originalBalance,
      lifetime_tokens_used: params.originalLifetimeUsed,
    })
    .eq("id", params.userId);

  if (profileRollback.error) {
    console.error("Failed to rollback token reservation", profileRollback.error);
  }

  if (params.quota) {
    const quotaRollback = await params.adminClient.rpc("release_performance_test_run", {
      p_scope_type: params.quota.scopeType,
      p_scope_id: params.quota.scopeId,
    });

    if (quotaRollback.error) {
      console.error("Failed to rollback quota reservation", quotaRollback.error);
    }
  }
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authorization = req.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ error: "Supabase environment is not configured." }, 500, req);
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authorization ? { Authorization: authorization } : {},
      },
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401, req);
    }

    const body = await req.json().catch(() => ({}));
    const {
      serviceUrl,
      testType,
      forceFresh = false,
      isScheduled = false,
      batchSize = 1,
    } = body as Record<string, unknown>;

    const normalizedServiceUrl = typeof serviceUrl === "string" ? serviceUrl.trim() : "";
    const normalizedTestType = typeof testType === "string" ? testType.trim().toLowerCase() : "";

    if (!normalizedServiceUrl || !normalizedTestType) {
      return jsonResponse({ error: "Missing required parameters" }, 400, req);
    }

    if (!VALID_TEST_TYPES.has(normalizedTestType)) {
      return jsonResponse({ error: "Unsupported test type" }, 400, req);
    }

    try {
      const parsedUrl = new URL(normalizedServiceUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return jsonResponse({ error: "Service URL must use http or https" }, 400, req);
      }
    } catch {
      return jsonResponse({ error: "Invalid service URL" }, 400, req);
    }

    console.log(`Running ${normalizedTestType} test for ${normalizedServiceUrl}`);

    const estimatedTokens = computeTokenCost({
      testType: normalizedTestType,
      isScheduled: Boolean(isScheduled),
      batchSize: Number(batchSize || 1),
    });
    const cacheTtlSeconds = CACHE_TTL_SECONDS[normalizedTestType] ?? 60;
    const cacheThreshold = new Date(Date.now() - cacheTtlSeconds * 1000).toISOString();

    const quotaPreview = await getPerformanceQuotaState(adminClient as never, user);

    const profileSelect = await adminClient
      .from("user_profiles")
      .select("token_balance, lifetime_tokens_used")
      .eq("id", user.id)
      .limit(1);

    if (profileSelect.error) {
      throw new Error(`Failed to load user profile: ${profileSelect.error.message}`);
    }

    const profile = profileSelect.data?.[0] ?? {
      token_balance: 0,
      lifetime_tokens_used: 0,
    };

    const cachedLookup = await adminClient
      .from("tests")
      .select("*")
      .eq("user_id", user.id)
      .eq("service_url", normalizedServiceUrl)
      .eq("test_type", normalizedTestType)
      .eq("status", "completed")
      .gte("created_at", cacheThreshold)
      .order("created_at", { ascending: false })
      .limit(1);

    const cachedTest = cachedLookup.data?.[0] ?? null;
    if (!forceFresh && !cachedLookup.error && cachedTest) {
      return jsonResponse({
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
          mode: "cached",
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
        quota: buildQuotaPayload(quotaPreview),
      }, 200, req);
    }

    const currentBalance = Number(profile.token_balance ?? 0);
    const lifetimeUsedBefore = Number(profile.lifetime_tokens_used ?? 0);
    if (currentBalance < estimatedTokens) {
      return jsonResponse({
        error: "Insufficient tokens",
        balance: currentBalance,
        required: estimatedTokens,
      }, 402, req);
    }

    const quota = await reservePerformanceRun(adminClient as never, user);

    if (quota.exhaustedMessage) {
      return jsonResponse({
        error: quota.exhaustedMessage,
        quota: buildQuotaPayload(quota),
      }, 429, req);
    }

    const reserveUpdate = await adminClient
      .from("user_profiles")
      .update({ token_balance: round2(currentBalance - estimatedTokens) })
      .eq("id", user.id)
      .gte("token_balance", estimatedTokens)
      .select("token_balance")
      .limit(1);

    if (reserveUpdate.error) {
      await rollbackReservedResources({
        adminClient,
        userId: user.id,
        originalBalance: currentBalance,
        originalLifetimeUsed: lifetimeUsedBefore,
        quota,
      });

      return jsonResponse({
        error: "Failed to reserve tokens",
        details: reserveUpdate.error.message,
      }, 409, req);
    }

    const reservedBalance = Number((reserveUpdate.data?.[0] as { token_balance?: number } | undefined)?.token_balance ?? 0);
    let refundedTokens = 0;
    let finalDeductedTokens = estimatedTokens;
    let runStatus: "completed" | "failed" = "completed";
    let runErrorMessage: string | null = null;

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
      if (normalizedTestType === "latency" || normalizedTestType === "load" || normalizedTestType === "throughput") {
        const response = await fetch(normalizedServiceUrl, {
          method: "GET",
          signal: AbortSignal.timeout(10000),
        });

        const latency = Date.now() - startTime;
        testResults.latency = latency;
        testResults.uptime = response.ok ? 100 : 0;
        testResults.success_rate = response.ok ? 100 : 0;

        if (normalizedTestType === "throughput") {
          const responseText = await response.text();
          const sizeInBytes = new TextEncoder().encode(responseText).length;
          const sizeInKB = sizeInBytes / 1024;
          const timeInSeconds = latency / 1000;
          testResults.throughput = timeInSeconds > 0 ? sizeInKB / timeInSeconds : 0;
        }
      }

      if (normalizedTestType === "uptime") {
        let response = await fetch(normalizedServiceUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(5000),
        });

        if (response.status === 405 || response.status === 501) {
          response = await fetch(normalizedServiceUrl, {
            method: "GET",
            signal: AbortSignal.timeout(5000),
          });
        }

        testResults.latency = Date.now() - startTime;
        testResults.uptime = response.ok ? 100 : 0;
        testResults.success_rate = response.ok ? 100 : 0;
      }
    } catch (error) {
      console.error("Test error:", error);
      testResults.uptime = 0;
      testResults.success_rate = 0;
      testResults.latency = Date.now() - startTime;
      runStatus = "failed";
      runErrorMessage = error instanceof Error ? error.message : "Unknown test failure";
    }

    const elapsedMs = Math.max(1, Date.now() - startTime);
    const timeoutMs = normalizedTestType === "load" ? 30000 : 10000;

    if (runStatus === "failed") {
      const lowerMessage = (runErrorMessage || "").toLowerCase();
      const targetDown =
        lowerMessage.includes("fetch failed") ||
        lowerMessage.includes("name not resolved") ||
        lowerMessage.includes("connection refused") ||
        lowerMessage.includes("dns");
      const timedOut = lowerMessage.includes("timed out") || lowerMessage.includes("aborted");

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
        .from("user_profiles")
        .update({ token_balance: refundTarget })
        .eq("id", user.id)
        .select("token_balance")
        .limit(1);

      if (refundUpdate.error) {
        console.error("Refund update failed", refundUpdate.error);
      }
    }

    const finalBalance = round2(reservedBalance + refundedTokens);
    const lifetimeUsedAfter = round2(lifetimeUsedBefore + finalDeductedTokens);

    const profileFinalize = await adminClient
      .from("user_profiles")
      .update({
        token_balance: finalBalance,
        lifetime_tokens_used: lifetimeUsedAfter,
      })
      .eq("id", user.id);

    if (profileFinalize.error) {
      console.error("Failed to finalize profile token counters", profileFinalize.error);
    }

    const txInsert = await adminClient.from("token_transactions").insert([
      {
        user_id: user.id,
        type: "debit",
        amount: finalDeductedTokens,
        balance_after: finalBalance,
        description: `QoS ${normalizedTestType} test`,
        endpoint: normalizedServiceUrl,
      },
      ...(refundedTokens > 0
        ? [
            {
              user_id: user.id,
              type: "credit",
              amount: refundedTokens,
              balance_after: finalBalance,
              description: `QoS ${normalizedTestType} refund`,
              endpoint: normalizedServiceUrl,
            },
          ]
        : []),
    ]);

    if (txInsert.error) {
      console.error("Token transaction logging failed", txInsert.error);
    }

    const { data: testRecord, error: insertError } = await adminClient
      .from("tests")
      .insert({
        user_id: user.id,
        service_url: normalizedServiceUrl,
        test_type: normalizedTestType,
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
      console.error("Database error:", insertError);
      await rollbackReservedResources({
        adminClient,
        userId: user.id,
        originalBalance: currentBalance,
        originalLifetimeUsed: lifetimeUsedBefore,
        quota,
      });
      return jsonResponse({
        error: "Failed to store test results",
        details: insertError.message,
      }, 500, req);
    }

    const predictedEfficiency = computePredictedEfficiency({
      latency: testResults.latency ?? 0,
      throughput: testResults.throughput ?? 0,
      availability: testResults.uptime ?? 0,
      reliability: testResults.success_rate ?? 0,
    });

    let matchedService: { id: string } | null = null;
    const baseMatch = await adminClient
      .from("web_services")
      .select("id")
      .eq("base_url", normalizedServiceUrl)
      .maybeSingle();

    if (baseMatch.error) {
      console.error("web_services base_url match failed:", baseMatch.error);
    } else {
      matchedService = (baseMatch.data as { id: string } | null) ?? null;
    }

    if (!matchedService) {
      const docsMatch = await adminClient
        .from("web_services")
        .select("id")
        .eq("docs_url", normalizedServiceUrl)
        .maybeSingle();

      if (docsMatch.error) {
        console.error("web_services docs_url match failed:", docsMatch.error);
      } else {
        matchedService = (docsMatch.data as { id: string } | null) ?? null;
      }
    }

    const { error: predictionInsertError } = await adminClient
      .from("qos_predictions")
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
      console.error("qos_predictions insert error:", predictionInsertError);
    }

    if (matchedService?.id) {
      const { error: serviceUpdateError } = await adminClient
        .from("web_services")
        .update({
          avg_latency: testResults.latency ?? 0,
          availability_score: testResults.uptime ?? 0,
          reliability_score: testResults.success_rate ?? 0,
        })
        .eq("id", matchedService.id);

      if (serviceUpdateError) {
        console.error("web_services update error:", serviceUpdateError);
      }
    }

    await logPerformanceRun(adminClient as never, quota, {
      testRunId: testRecord.id,
      testType: normalizedTestType,
      durationMs: elapsedMs,
      status: runStatus,
      latency: testResults.latency,
      uptime: testResults.uptime,
      throughput: testResults.throughput,
      successRate: testResults.success_rate,
      errorMessage: runErrorMessage,
    });

    console.log("Test completed successfully:", testRecord);
    return jsonResponse({
      success: true,
      data: testRecord,
      results: testResults,
      predicted_efficiency: predictedEfficiency,
      token: {
        mode: "live",
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
        ...buildQuotaPayload(quota),
        summary: `Run ${quota.runNumber} of ${quota.runLimit} used. ${quota.runsRemaining} runs remaining this cycle.`,
      },
    }, 200, req);
  } catch (error) {
    console.error("Function error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: errorMessage }, 500, req);
  }
});
