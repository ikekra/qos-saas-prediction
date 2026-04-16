import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401, req);
    }

    const body = await req.json().catch(() => ({}));
    const { keywords } = body ?? {};
    const type = (body?.type ?? "user") as string;

    const { data: services, error: servicesError } = await supabaseClient
      .from("web_services")
      .select("id, service_name, name, provider, category, logo_url, description, avg_latency, availability_score, reliability_score, is_active")
      .eq("is_active", true);

    if (servicesError) throw servicesError;
    const allServices = services ?? [];

    if (type === "keywords" && keywords) {
      const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
      const lowerKeywords = keywordArray.map((k: string) => k.toLowerCase());

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
            reason:
              score > 0
                ? `Keyword match: ${[...new Set(matchedKeywords)].join(", ")}`
                : null,
          };
        })
        .filter((s: any) => s.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 10);

      if (scoredServices.length > 0) {
        await supabaseClient.from("service_recommendations").insert(
          scoredServices.map((service: any) => ({
            user_id: user.id,
            service_id: service.id,
            score: service.score,
            reason: service.reason,
          })),
        );
      }

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

      const predictionList = (userPredictions ?? []).filter((p: any) => p.service_id);
      const usedServiceIds = new Set(predictionList.map((p: any) => p.service_id));
      const categoryCounts: Record<string, number> = {};

      predictionList.forEach((prediction: any) => {
        const service = allServices.find((s: any) => s.id === prediction.service_id);
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
        .filter((s: any) => s !== null)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 10);

      if (scoredServices.length > 0) {
        await supabaseClient.from("service_recommendations").insert(
          scoredServices.map((service: any) => ({
            user_id: user.id,
            service_id: service.id,
            score: service.score,
            reason: service.reason,
          })),
        );
      }

      return jsonResponse({ success: true, recommendations: scoredServices }, 200, req);
    }

    return jsonResponse({ error: "Invalid request type" }, 400, req);
  } catch (error) {
    console.error("Recommendation error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal error" }, 500, req);
  }
});
