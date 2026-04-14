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
    const keywords = (body as { keywords?: unknown }).keywords;
    const type = String((body as { type?: unknown }).type ?? "user").trim();

    const { data: services, error: servicesError } = await supabaseClient
      .from("web_services")
      .select("id, service_name, name, provider, category, logo_url, description, avg_latency, availability_score, reliability_score, is_active")
      .eq("is_active", true);

    if (servicesError) throw servicesError;
    const allServices = services ?? [];

    const insertRecommendations = async (rows: Array<{ id: string; score: number; reason: string | null }>) => {
      if (rows.length === 0) return;

      const insert = await supabaseClient
        .from("service_recommendations")
        .insert(
          rows.map((service) => ({
            user_id: user.id,
            service_id: service.id,
            score: service.score,
            reason: service.reason,
          })),
        );

      if (insert.error) {
        console.error("Failed to persist recommendations", insert.error);
      }
    };

    if (type === "keywords" && keywords) {
      const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
      const lowerKeywords = keywordArray.map((keyword) => String(keyword ?? "").toLowerCase().trim()).filter(Boolean);

      const scoredServices = allServices
        .map((service: any) => {
          let score = 0;
          const matchedKeywords: string[] = [];

          lowerKeywords.forEach((keyword) => {
            const nameLower = (service.service_name || service.name || "").toLowerCase();
            const descLower = (service.description || "").toLowerCase();
            const categoryLower = (service.category || "").toLowerCase();

            if (nameLower.includes(keyword)) {
              score += 5;
              matchedKeywords.push(keyword);
            }
            if (categoryLower.includes(keyword)) {
              score += 4;
              matchedKeywords.push(keyword);
            }
            if (descLower.includes(keyword)) {
              score += 3;
              matchedKeywords.push(keyword);
            }
          });

          return {
            ...service,
            score,
            reason: score > 0 ? `Keyword match: ${[...new Set(matchedKeywords)].join(", ")}` : null,
          };
        })
        .filter((service: any) => service.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 10);

      await insertRecommendations(scoredServices);
      return jsonResponse({ success: true, recommendations: scoredServices }, 200, req);
    }

    if (type === "user") {
      const { data: userPredictions, error: predictionsError } = await supabaseClient
        .from("qos_predictions")
        .select("service_id, predicted_efficiency")
        .eq("user_id", user.id)
        .not("service_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (predictionsError) throw predictionsError;

      const predictionList = (userPredictions ?? []).filter((prediction: any) => prediction.service_id);
      const usedServiceIds = new Set(predictionList.map((prediction: any) => prediction.service_id));
      const categoryCounts: Record<string, number> = {};

      predictionList.forEach((prediction: any) => {
        const service = allServices.find((row: any) => row.id === prediction.service_id);
        if (service?.category) {
          categoryCounts[service.category] = (categoryCounts[service.category] ?? 0) + 1;
        }
      });

      const maxCategoryCount = Math.max(1, ...Object.values(categoryCounts));

      const scoredServices = allServices
        .map((service: any) => {
          const availability = Number(service.availability_score ?? 0);
          const reliability = Number(service.reliability_score ?? 0);
          const latency = Number(service.avg_latency ?? 300);
          const latencyScore = Math.max(0, 300 - latency) / 3;
          const baseScore = availability * 0.45 + reliability * 0.35 + latencyScore * 0.2;

          const categoryBoost =
            service.category && categoryCounts[service.category]
              ? (categoryCounts[service.category] / maxCategoryCount) * 10
              : 0;

          const alreadyUsed = usedServiceIds.has(service.id);
          const score = baseScore + categoryBoost - (alreadyUsed ? 8 : 0);

          const reasons: string[] = [];
          if (categoryBoost > 0) reasons.push("Matches your preferred category");
          if (availability >= 99.5) reasons.push("High availability");
          if (reliability >= 99.5) reasons.push("High reliability");
          if (latency <= 150) reasons.push("Low latency");
          if (!alreadyUsed) reasons.push("New to explore");

          return score > 0
            ? {
                ...service,
                score,
                reason: reasons.join(", "),
              }
            : null;
        })
        .filter((service: any) => service !== null)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 10);

      await insertRecommendations(scoredServices);
      return jsonResponse({ success: true, recommendations: scoredServices }, 200, req);
    }

    return jsonResponse({ error: "Invalid request type" }, 400, req);
  } catch (error) {
    console.error("Recommendation error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal error" }, 500, req);
  }
});
