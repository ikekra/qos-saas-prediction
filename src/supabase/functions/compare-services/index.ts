import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

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
    const authorization = req.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "Supabase environment is not configured." }, 500, req);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: authorization ? { Authorization: authorization } : {},
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401, req);
    }

    const body = await req.json().catch(() => ({}));
    const serviceIds = Array.isArray((body as { serviceIds?: unknown[] }).serviceIds)
      ? (body as { serviceIds: unknown[] }).serviceIds.map((id) => String(id ?? "").trim()).filter(Boolean)
      : [];

    if (serviceIds.length < 2 || serviceIds.length > 3) {
      return jsonResponse({ error: "Please provide 2-3 service IDs" }, 400, req);
    }

    const { data: services, error: servicesError } = await supabaseClient
      .from("web_services")
      .select("*")
      .in("id", serviceIds);

    if (servicesError) {
      throw servicesError;
    }

    if (!services || services.length !== serviceIds.length) {
      return jsonResponse({ error: "One or more services not found" }, 404, req);
    }

    const testResults = await Promise.all(
      services.map(async (service: any) => {
        const serviceUrl = service.base_url || service.docs_url;
        if (!serviceUrl) return { serviceId: service.id, tests: [] };

        const { data, error } = await supabaseClient
          .from("tests")
          .select("latency, throughput, uptime, success_rate, created_at, service_url")
          .eq("service_url", serviceUrl)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;
        return { serviceId: service.id, tests: data || [] };
      }),
    );

    const comparison = services.map((service: any) => {
      const tests = testResults.find((result) => result.serviceId === service.id)?.tests || [];

      const avgLatency = tests.length > 0
        ? tests.reduce((sum: number, test: any) => sum + Number(test.latency || 0), 0) / tests.length
        : Number(service.avg_latency || service.base_latency_estimate || 0);

      const avgThroughput = tests.length > 0
        ? tests.reduce((sum: number, test: any) => sum + Number(test.throughput || 0), 0) / tests.length
        : 0;

      const avgSuccessRate = tests.length > 0
        ? tests.reduce((sum: number, test: any) => sum + Number(test.success_rate || 0), 0) / tests.length
        : 100;

      const avgUptime = tests.length > 0
        ? tests.reduce((sum: number, test: any) => sum + Number(test.uptime || 0), 0) / tests.length
        : Number(service.availability_score || 0);

      return {
        id: service.id,
        name: service.service_name || service.name,
        category: service.category,
        description: service.description,
        avg_rating: service.avg_rating || 0,
        total_ratings: service.total_ratings || 0,
        metrics: {
          latency: Math.round(avgLatency),
          throughput: Math.round(avgThroughput * 100) / 100,
          errorRate: Math.round((100 - avgSuccessRate) * 100) / 100,
          successRate: Math.round(avgSuccessRate * 100) / 100,
          uptime: Math.round(avgUptime * 100) / 100,
        },
        recentTests: tests.length,
      };
    });

    const bestLatency = comparison.reduce((min: any, current: any) =>
      current.metrics.latency < min.metrics.latency ? current : min,
    );
    const bestRating = comparison.reduce((max: any, current: any) =>
      current.avg_rating > max.avg_rating ? current : max,
    );
    const bestThroughput = comparison.reduce((max: any, current: any) =>
      current.metrics.throughput > max.metrics.throughput ? current : max,
    );

    return jsonResponse({
      success: true,
      comparison,
      insights: {
        bestLatency: bestLatency.name,
        bestRating: bestRating.name,
        bestThroughput: bestThroughput.name,
      },
    }, 200, req);
  } catch (error) {
    console.error("Comparison error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal error" }, 500, req);
  }
});
