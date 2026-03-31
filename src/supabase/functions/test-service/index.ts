import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173").split(",")[0].trim(),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization") ?? "",
          },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { serviceId, testType = "latency", runCount = 1 } = await req.json();

    if (!serviceId) {
      return new Response(JSON.stringify({ error: "Service ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: service, error: serviceError } = await supabaseClient
      .from("web_services")
      .select("*")
      .eq("id", serviceId)
      .single();

    if (serviceError || !service) {
      return new Response(JSON.stringify({ error: "Service not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    const serviceUrl = service.base_url || service.docs_url;
    if (!serviceUrl) {
      return new Response(JSON.stringify({ error: "Service URL not available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (let i = 0; i < Math.min(runCount, 10); i++) {
      const startTime = Date.now();
      let latency = 0;
      let throughput: number | null = null;
      let uptime: number | null = null;
      let successRate: number | null = null;
      let status = "completed";

      try {
        // Create timeout controller
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        // latency & load test
        if (testType === "latency" || testType === "load") {
          const response = await fetch(serviceUrl, {
            method: "GET",
            signal: controller.signal,
          });

          latency = Date.now() - startTime;
          successRate = response.ok ? 100 : 0;
          uptime = response.ok ? 100 : 0;
        }

        // throughput test
        if (testType === "throughput") {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          const requests = Array(3)
            .fill(null)
            .map(() =>
              fetch(serviceUrl, {
                method: "GET",
                signal: controller.signal,
              })
            );

          const responses = await Promise.all(requests);

          latency = (Date.now() - startTime) / 3;

          const successCount = responses.filter((r) => r.ok).length;
          successRate = (successCount / 3) * 100;
          uptime = successRate;

          const text = await responses[0].text();
          const sizeBytes = new TextEncoder().encode(text).length;
          const sizeKB = sizeBytes / 1024;

          const timeSec = (latency * 3) / 1000;
          throughput = timeSec > 0 ? sizeKB / timeSec : 0;
        }

        if (testType === "uptime") {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const response = await fetch(serviceUrl, {
            method: "HEAD",
            signal: controller.signal,
          });
          clearTimeout(timeout);
          latency = Date.now() - startTime;
          successRate = response.ok ? 100 : 0;
          uptime = successRate;
        }
      } catch (err) {
        latency = Date.now() - startTime;
        successRate = 0;
        uptime = 0;
        status = "failed";
      }

      const { data: testResult } = await supabaseClient
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
        })
        .select()
        .single();

      results.push(testResult);
    }

    const avgLatency =
      results.reduce((a, b) => a + b.latency, 0) / results.length;
    const avgThroughput =
      results.reduce((a, b) => a + (b.throughput || 0), 0) / results.length;
    const avgSuccessRate =
      results.reduce((a, b) => a + (b.success_rate || 0), 0) / results.length;
    const avgUptime =
      results.reduce((a, b) => a + (b.uptime || 0), 0) / results.length;

    return new Response(
      JSON.stringify({
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

