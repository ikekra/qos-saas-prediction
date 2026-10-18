import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, corsHeaders } from "../_shared/cors.ts";
import { withTokenCheck } from "../_shared/token-check.ts";
import {
  buildPerformanceAlerts,
  computeConfidenceScore,
  getTokenCost,
} from "../_shared/performance-policy.ts";

type PredictRequest = {
  service_id?: string;
  service_url?: string;
  latency: number;
  throughput: number;
  availability: number;
  reliability: number;
  response_time: number;
  baseline_throughput_rps?: number;
};

type PredictionRow = {
  id: string;
  service_id: string | null;
  latency: number;
  throughput: number;
  availability: number;
  reliability: number;
  response_time: number;
  predicted_efficiency: number;
  created_at: string;
};

const CACHE_TTL_SECONDS = Number(Deno.env.get("PREDICTION_CACHE_TTL_SECONDS") ?? "90");
const METRIC_EPSILON = 0.001;

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isIsoDate = (value: string) => !Number.isNaN(Date.parse(value));

const validateServiceUrl = (serviceUrl?: string): string | null => {
  if (!serviceUrl) return null;
  try {
    const parsed = new URL(serviceUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const nearlyEqual = (a: number, b: number) => Math.abs(a - b) <= METRIC_EPSILON;

const buildLatencyPercentiles = (latencyMs: number, mlData: Record<string, unknown>) => {
  const p50 = toNumber(mlData.latency_p50_ms) ?? latencyMs;
  const p95 = toNumber(mlData.latency_p95_ms) ?? Math.max(p50, latencyMs * 1.25);
  const p99 = toNumber(mlData.latency_p99_ms) ?? Math.max(p95, latencyMs * 1.5);
  return {
    p50_ms: Number(p50.toFixed(2)),
    p95_ms: Number(p95.toFixed(2)),
    p99_ms: Number(p99.toFixed(2)),
  };
};

const validatePayload = (body: Record<string, unknown>): PredictRequest | null => {
  const latency = toNumber(body.latency);
  const throughput = toNumber(body.throughput);
  const availability = toNumber(body.availability);
  const reliability = toNumber(body.reliability);
  const response_time = toNumber(body.response_time);
  const baseline_throughput_rps = toNumber(body.baseline_throughput_rps) ?? undefined;
  const service_id = typeof body.service_id === "string" ? body.service_id : undefined;
  const service_url_raw = typeof body.service_url === "string" ? body.service_url.trim() : undefined;
  const service_url = validateServiceUrl(service_url_raw || undefined);

  if (
    latency === null || latency < 0 ||
    throughput === null || throughput < 0 ||
    availability === null || availability < 0 || availability > 100 ||
    reliability === null || reliability < 0 || reliability > 100 ||
    response_time === null || response_time < 0
  ) {
    return null;
  }

  if (service_url_raw && !service_url) return null;

  return {
    service_id,
    service_url: service_url ?? undefined,
    latency,
    throughput,
    availability,
    reliability,
    response_time,
    baseline_throughput_rps,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  const body = await req.json().catch(() => ({}));
  const payload = validatePayload(body as Record<string, unknown>);
  if (!payload) {
    return jsonResponse(
      {
        error:
          "Invalid payload. Provide numeric latency/throughput/availability/reliability/response_time and a valid http(s) service_url (if present).",
      },
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const cacheSinceIso = new Date(Date.now() - CACHE_TTL_SECONDS * 1000).toISOString();
  const cachedRes = await authClient
    .from("qos_predictions")
    .select("id, service_id, latency, throughput, availability, reliability, response_time, predicted_efficiency, created_at")
    .gte("created_at", cacheSinceIso)
    .order("created_at", { ascending: false })
    .limit(25);

  if (!cachedRes.error) {
    const exactMatch = (cachedRes.data as PredictionRow[] | null)?.find((row) => {
      const rowService = row.service_id ?? null;
      const reqService = payload.service_id ?? null;
      return (
        rowService === reqService &&
        nearlyEqual(Number(row.latency), payload.latency) &&
        nearlyEqual(Number(row.throughput), payload.throughput) &&
        nearlyEqual(Number(row.availability), payload.availability) &&
        nearlyEqual(Number(row.reliability), payload.reliability) &&
        nearlyEqual(Number(row.response_time), payload.response_time)
      );
    });

    if (exactMatch && isIsoDate(exactMatch.created_at)) {
      const profileRes = await authClient
        .from("user_profiles")
        .select("token_balance")
        .eq("id", user.id)
        .maybeSingle();
      const tokenBalance = Number(profileRes.data?.token_balance ?? 0);

      const cachedLatency = Number(exactMatch.response_time ?? exactMatch.latency ?? 0);
      const percentiles = buildLatencyPercentiles(cachedLatency, {});
      const alerts = buildPerformanceAlerts({
        predictedLatencyMs: cachedLatency,
        predictedThroughputRps: Number(exactMatch.throughput ?? 0),
        predictedUptimePercent: Number(exactMatch.availability ?? 0),
        baselineThroughputRps: payload.baseline_throughput_rps,
      });

      return jsonResponse(
        {
          success: true,
          summary: "Prediction served from cache. 0 tokens deducted.",
          cache: {
            hit: true,
            ttl_seconds: CACHE_TTL_SECONDS,
            cached_at: exactMatch.created_at,
          },
          report: {
            service_url: payload.service_url ?? payload.service_id ?? "unknown",
            predicted_latency_ms: Number(cachedLatency.toFixed(2)),
            predicted_latency_percentiles_ms: percentiles,
            predicted_throughput_rps: Number(Number(exactMatch.throughput).toFixed(2)),
            predicted_uptime_percent: Number(Number(exactMatch.availability).toFixed(3)),
            confidence_score: computeConfidenceScore(
              Number(exactMatch.reliability ?? payload.reliability),
              Number(exactMatch.availability ?? payload.availability),
            ),
            predicted_at: new Date().toISOString(),
            tokens_used: 0,
            tokens_remaining: tokenBalance,
            alerts,
          },
          prediction: exactMatch,
        },
        200,
      );
    }
  }

  const fullReportTokenCost = getTokenCost("fullReport");

  return withTokenCheck(
    req,
    fullReportTokenCost,
    "Full performance report",
    async ({ supabase, tokenResult }) => {
      const requestStartedAt = Date.now();

      const insertEfficiencyLog = async (params: {
        statusCode: number;
        requestPayload: Record<string, unknown>;
        predictionResponse?: Record<string, unknown> | null;
        errorMessage?: string | null;
      }) => {
        const { error } = await supabase
          .from("efficiency_logs")
          .insert({
            user_id: user.id,
            request_payload: params.requestPayload,
            prediction_response: params.predictionResponse ?? null,
            status_code: params.statusCode,
            status: params.statusCode >= 200 && params.statusCode < 300 ? "success" : "error",
            error_message: params.errorMessage ?? null,
            latency_ms: Date.now() - requestStartedAt,
          });

        if (error) console.error("Failed to write efficiency_logs:", error.message);
      };

      const mlApiUrl = Deno.env.get("ML_API_URL");
      const mlApiKey = Deno.env.get("ML_API_KEY");
      const mlApiTimeoutMs = Number(Deno.env.get("ML_API_TIMEOUT_MS") ?? "12000");

      if (!mlApiUrl) {
        const message = "ML_API_URL is not configured";
        await insertEfficiencyLog({
          statusCode: 500,
          requestPayload: payload,
          errorMessage: message,
        });
        return jsonResponse({ error: message }, 500);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), mlApiTimeoutMs);

      let mlResponse: Response;
      try {
        mlResponse = await fetch(mlApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(mlApiKey ? { "x-api-key": mlApiKey } : {}),
          },
          body: JSON.stringify({
            latency: payload.latency,
            throughput: payload.throughput,
            availability: payload.availability,
            reliability: payload.reliability,
            response_time: payload.response_time,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!mlResponse.ok) {
        const errorBody = await mlResponse.text().catch(() => "");
        const details = errorBody || mlResponse.statusText;
        await insertEfficiencyLog({
          statusCode: 502,
          requestPayload: payload,
          errorMessage: `ML API request failed: ${details}`,
        });
        return jsonResponse({ error: "ML API request failed", details }, 502);
      }

      const mlData = (await mlResponse.json()) as Record<string, unknown>;
      const predictedEfficiency = toNumber(mlData.predicted_efficiency);

      if (predictedEfficiency === null) {
        const message = "ML API response missing predicted_efficiency";
        await insertEfficiencyLog({
          statusCode: 502,
          requestPayload: payload,
          predictionResponse: mlData,
          errorMessage: message,
        });
        return jsonResponse({ error: message }, 502);
      }

      const predictedLatency = toNumber(mlData.predicted_latency_ms) ?? payload.response_time ?? payload.latency;
      const predictedThroughput = toNumber(mlData.predicted_throughput_rps) ?? payload.throughput;
      const predictedUptime = toNumber(mlData.predicted_uptime_percent) ?? payload.availability;
      const confidenceScore = (
        typeof mlData.confidence_score === "string"
          ? mlData.confidence_score.toLowerCase()
          : computeConfidenceScore(payload.reliability, payload.availability)
      ) as "low" | "medium" | "high";
      const latencyPercentiles = buildLatencyPercentiles(predictedLatency, mlData);

      const alerts = buildPerformanceAlerts({
        predictedLatencyMs: predictedLatency,
        predictedThroughputRps: predictedThroughput,
        predictedUptimePercent: predictedUptime,
        baselineThroughputRps: payload.baseline_throughput_rps,
      });

      const { data: inserted, error: insertError } = await supabase
        .from("qos_predictions")
        .insert({
          service_id: payload.service_id ?? null,
          latency: payload.latency,
          throughput: payload.throughput,
          availability: payload.availability,
          reliability: payload.reliability,
          response_time: payload.response_time,
          predicted_efficiency: predictedEfficiency,
        })
        .select("id, service_id, latency, throughput, availability, reliability, response_time, predicted_efficiency, created_at")
        .single();

      if (insertError) {
        await insertEfficiencyLog({
          statusCode: 500,
          requestPayload: payload,
          predictionResponse: { predicted_efficiency: predictedEfficiency },
          errorMessage: `Failed to store prediction: ${insertError.message}`,
        });
        return jsonResponse({ error: "Failed to store prediction", details: insertError.message }, 500);
      }

      const report = {
        service_url: payload.service_url ?? payload.service_id ?? "unknown",
        predicted_latency_ms: Number(predictedLatency.toFixed(2)),
        predicted_latency_percentiles_ms: latencyPercentiles,
        predicted_throughput_rps: Number(predictedThroughput.toFixed(2)),
        predicted_uptime_percent: Number(predictedUptime.toFixed(3)),
        confidence_score: confidenceScore,
        predicted_at: new Date().toISOString(),
        tokens_used: tokenResult.deducted ?? fullReportTokenCost,
        tokens_remaining: tokenResult.balance ?? 0,
        alerts,
      };

      const summary = alerts.length > 0
        ? `Prediction complete with ${alerts.length} anomaly alert(s).`
        : "Prediction complete. No anomalies detected against configured thresholds.";

      await insertEfficiencyLog({
        statusCode: 200,
        requestPayload: payload,
        predictionResponse: {
          predicted_efficiency: predictedEfficiency,
          report,
          prediction_id: inserted.id,
        },
      });

      return jsonResponse(
        {
          success: true,
          summary,
          cache: {
            hit: false,
            ttl_seconds: CACHE_TTL_SECONDS,
          },
          report,
          prediction: inserted,
        },
        200,
      );
    },
  );
});
