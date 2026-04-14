import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

const VALID_TEST_TYPES = new Set(["latency", "load", "uptime", "throughput"]);

const withTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405, req);
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
    const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";
    const testType = typeof body.testType === "string" ? body.testType.trim().toLowerCase() : "latency";
    const runCount = Math.max(1, Math.min(Number(body.runCount ?? 1), 10));

    if (!serviceId) {
      return jsonResponse({ error: "Service ID required" }, 400, req);
    }

    if (!VALID_TEST_TYPES.has(testType)) {
      return jsonResponse({ error: "Unsupported test type" }, 400, req);
    }

    const { data: service, error: serviceError } = await adminClient
      .from("web_services")
      .select("*")
      .eq("id", serviceId)
      .single();

    if (serviceError || !service) {
      return jsonResponse({ error: "Service not found" }, 404, req);
    }

    const serviceUrl = service.base_url || service.docs_url;
    if (!serviceUrl) {
      return jsonResponse({ error: "Service URL not available" }, 400, req);
    }

    const results: Array<Record<string, unknown>> = [];

    for (let i = 0; i < runCount; i += 1) {
      const startTime = Date.now();
      let latency = 0;
      let throughput: number | null = null;
      let uptime: number | null = null;
      let successRate: number | null = null;
      let status = "completed";
      let errorMessage: string | null = null;

      try {
        if (testType === "latency" || testType === "load") {
          const response = await withTimeout(serviceUrl, { method: "GET" }, 10000);
          latency = Date.now() - startTime;
          successRate = response.ok ? 100 : 0;
          uptime = response.ok ? 100 : 0;
        }

        if (testType === "throughput") {
          const responses = await Promise.all(
            Array.from({ length: 3 }, () => withTimeout(serviceUrl, { method: "GET" }, 10000)),
          );

          latency = (Date.now() - startTime) / 3;
          const successCount = responses.filter((response) => response.ok).length;
          successRate = (successCount / 3) * 100;
          uptime = successRate;

          const text = await responses[0].text();
          const sizeBytes = new TextEncoder().encode(text).length;
          const sizeKB = sizeBytes / 1024;
          const timeSec = (latency * 3) / 1000;
          throughput = timeSec > 0 ? sizeKB / timeSec : 0;
        }

        if (testType === "uptime") {
          let response = await withTimeout(serviceUrl, { method: "HEAD" }, 5000);
          if (response.status === 405 || response.status === 501) {
            response = await withTimeout(serviceUrl, { method: "GET" }, 5000);
          }
          latency = Date.now() - startTime;
          successRate = response.ok ? 100 : 0;
          uptime = successRate;
        }
      } catch (error) {
        latency = Date.now() - startTime;
        successRate = 0;
        uptime = 0;
        status = "failed";
        errorMessage = error instanceof Error ? error.message : "Unknown test failure";
      }

      const { data: testResult, error: insertError } = await adminClient
        .from("tests")
        .insert({
          user_id: user.id,
          service_url: serviceUrl,
          test_type: testType,
          latency: Math.round(latency),
          throughput: throughput === null ? null : Math.round(throughput * 100) / 100,
          uptime: uptime === null ? null : Math.round(uptime),
          success_rate: successRate === null ? null : Math.round(successRate),
          status,
          error_message: errorMessage,
        })
        .select()
        .single();

      if (insertError) {
        return jsonResponse({ error: "Failed to store test result", details: insertError.message }, 500, req);
      }

      results.push(testResult);
    }

    const avgLatency = results.reduce((sum, row) => sum + Number(row.latency ?? 0), 0) / results.length;
    const avgThroughput = results.reduce((sum, row) => sum + Number(row.throughput ?? 0), 0) / results.length;
    const avgSuccessRate = results.reduce((sum, row) => sum + Number(row.success_rate ?? 0), 0) / results.length;
    const avgUptime = results.reduce((sum, row) => sum + Number(row.uptime ?? 0), 0) / results.length;

    return jsonResponse({
      success: true,
      results,
      aggregate: {
        latency: Math.round(avgLatency),
        throughput: Math.round(avgThroughput * 100) / 100,
        successRate: Math.round(avgSuccessRate),
        uptime: Math.round(avgUptime),
      },
      service: {
        id: service.id,
        name: service.service_name || service.name,
      },
    }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500, req);
  }
});
