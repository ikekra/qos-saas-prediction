import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PredictRequest = {
  service_id?: string;
  latency: number;
  throughput: number;
  availability: number;
  reliability: number;
  response_time: number;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const validatePayload = (body: Record<string, unknown>): PredictRequest | null => {
  const latency = toNumber(body.latency);
  const throughput = toNumber(body.throughput);
  const availability = toNumber(body.availability);
  const reliability = toNumber(body.reliability);
  const response_time = toNumber(body.response_time);
  const service_id = typeof body.service_id === "string" ? body.service_id : undefined;

  if (
    latency === null || latency < 0 ||
    throughput === null || throughput < 0 ||
    availability === null || availability < 0 || availability > 100 ||
    reliability === null || reliability < 0 || reliability > 100 ||
    response_time === null || response_time < 0
  ) {
    return null;
  }

  return { service_id, latency, throughput, availability, reliability, response_time };
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const payload = validatePayload(body as Record<string, unknown>);
    const requestStartedAt = Date.now();

    const insertEfficiencyLog = async (params: {
      statusCode: number;
      requestPayload: Record<string, unknown>;
      predictionResponse?: Record<string, unknown> | null;
      errorMessage?: string | null;
    }) => {
      const { error } = await supabaseClient
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

      if (error) {
        console.error("Failed to write efficiency_logs:", error.message);
      }
    };

    if (!payload) {
      const message =
        "Invalid payload. Required numeric fields: latency, throughput, availability(0-100), reliability(0-100), response_time.";
      await insertEfficiencyLog({
        statusCode: 400,
        requestPayload: body as Record<string, unknown>,
        errorMessage: message,
      });
      return jsonResponse({ error: message }, 400);
    }

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
        body: JSON.stringify(payload),
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

    const mlData = await mlResponse.json();
    const predictedEfficiency = toNumber(mlData?.predicted_efficiency);

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

    const { data: inserted, error: insertError } = await supabaseClient
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
      .select("id, user_id, latency, throughput, availability, reliability, response_time, predicted_efficiency, created_at")
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

    await insertEfficiencyLog({
      statusCode: 200,
      requestPayload: payload,
      predictionResponse: { predicted_efficiency: predictedEfficiency, prediction_id: inserted.id },
    });

    return jsonResponse({ success: true, prediction: inserted }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
