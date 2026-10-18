import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed. Use POST." }, 405, req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const freeMonthlyTokens = Number(Deno.env.get("FREE_MONTHLY_TOKENS") ?? "500");

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "Supabase environment is not configured." }, 500, req);
  }

  try {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401, req);

    const { data, error } = await client.rpc("claim_free_monthly_tokens", {
      p_tokens: freeMonthlyTokens,
    });

    if (error) {
      return jsonResponse({ error: "Failed to claim free monthly tokens", details: error.message }, 500, req);
    }

    const payload = (data ?? {}) as {
      success?: boolean;
      error?: string;
      next_eligible_at?: string;
      tokens_granted?: number;
      new_balance?: number;
      claimed_month?: string;
    };

    if (!payload.success) {
      if (payload.error === "already_claimed") {
        return jsonResponse(
          {
            success: false,
            error: "already_claimed",
            message: "Free monthly plan already claimed for this month.",
            next_eligible_at: payload.next_eligible_at ?? null,
          },
          409,
          req,
        );
      }
      return jsonResponse({ success: false, error: payload.error ?? "claim_failed" }, 400, req);
    }

    return jsonResponse(
      {
        success: true,
        tokens_granted: payload.tokens_granted ?? freeMonthlyTokens,
        new_balance: payload.new_balance ?? null,
        claimed_month: payload.claimed_month ?? null,
      },
      200,
      req,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500, req);
  }
});
