import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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
      .from("services")
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

    for (let i = 0; i < Math.min(runCount, 10); i++) {
      const startTime = Date.now();
      let latency = 0;
      let throughput = 0;
      let errorRate = 0;
      let successRate = 100;
      let status = "completed";

      try {
        // Create timeout controller
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        // latency & load test
        if (testType === "latency" || testType === "load") {
          const response = await fetch(service.base_url, {
            method: "GET",
            signal: controller.signal,
          });

          latency = Date.now() - startTime;
          successRate = response.ok ? 100 : 0;
          errorRate = response.ok ? 0 : 100;
        }

        // throughput test
        if (testType === "throughput") {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);

          const requests = Array(3)
            .fill(null)
            .map(() =>
              fetch(service.base_url, {
                method: "GET",
                signal: controller.signal,
              })
            );

          const responses = await Promise.all(requests);

          latency = (Date.now() - startTime) / 3;

          const successCount = responses.filter((r) => r.ok).length;
          successRate = (successCount / 3) * 100;
          errorRate = 100 - successRate;

          const text = await responses[0].text();
          const sizeBytes = new TextEncoder().encode(text).length;
          const sizeKB = sizeBytes / 1024;

          const timeSec = (latency * 3) / 1000;
          throughput = sizeKB / timeSec;
        }
      } catch (err) {
        latency = Date.now() - startTime;
        successRate = 0;
        errorRate = 100;
        status = "failed";
      }

      const { data: testResult } = await supabaseClient
        .from("test_results")
        .insert({
          service_id: serviceId,
          user_id: user.id,
          test_type: testType,
          latency: Math.round(latency),
          throughput: Math.round(throughput * 100) / 100,
          error_rate: Math.round(errorRate),
          success_rate: Math.round(successRate),
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
    const avgErrorRate =
      results.reduce((a, b) => a + b.error_rate, 0) / results.length;
    const avgSuccessRate =
      results.reduce((a, b) => a + b.success_rate, 0) / results.length;

    return new Response(
      JSON.stringify({
        success: true,
        results,
        aggregate: {
          latency: Math.round(avgLatency),
          throughput: Math.round(avgThroughput * 100) / 100,
          errorRate: Math.round(avgErrorRate),
          successRate: Math.round(avgSuccessRate),
        },
        service: {
          id: service.id,
          name: service.name,
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
