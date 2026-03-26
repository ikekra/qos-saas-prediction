import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TOKENS_PER_CALL = 500;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: req.headers.get("Authorization") ?? "" },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let data: any = null;
  let error: any = null;

  const fullRpc = await supabase.rpc("deduct_tokens", {
    p_user_id: user.id,
    p_amount: TOKENS_PER_CALL,
    p_description: "Dummy protected API call",
    p_endpoint: "/functions/v1/token-check-demo",
    p_request_id: crypto.randomUUID(),
  });
  data = fullRpc.data;
  error = fullRpc.error;

  if (error) {
    const minimalRpc = await supabase.rpc("deduct_tokens", {
      p_user_id: user.id,
      p_amount: TOKENS_PER_CALL,
    });
    if (!minimalRpc.error) {
      data = minimalRpc.data;
      error = null;
    } else {
      error = minimalRpc.error;
    }
  }

  if (error && supabaseServiceRoleKey) {
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey);
    let { data: profile, error: profileError } = await admin
      .from("user_profiles")
      .select("token_balance, lifetime_tokens_used")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return jsonResponse(
        {
          error: "Failed to deduct tokens",
          details: `${error.message} | fallback profile lookup failed: ${profileError.message}`,
        },
        500,
      );
    }

    if (!profile) {
      const safeEmail = user.email ?? `${user.id}@local.user`;
      const { error: createProfileError } = await admin.from("user_profiles").upsert(
        {
          id: user.id,
          email: safeEmail,
          token_balance: 0,
          lifetime_tokens_used: 0,
        },
        { onConflict: "id" },
      );

      if (createProfileError) {
        return jsonResponse(
          {
            error: "Failed to deduct tokens",
            details: `${error.message} | fallback profile init failed: ${createProfileError.message}`,
          },
          500,
        );
      }

      const { data: createdProfile, error: createdProfileError } = await admin
        .from("user_profiles")
        .select("token_balance, lifetime_tokens_used")
        .eq("id", user.id)
        .maybeSingle();

      if (createdProfileError || !createdProfile) {
        return jsonResponse(
          {
            error: "Failed to deduct tokens",
            details: `${error.message} | fallback profile lookup failed after init: ${createdProfileError?.message ?? "profile missing"}`,
          },
          500,
        );
      }

      profile = createdProfile;
    }

    const currentBalance = Number(profile.token_balance ?? 0);
    if (currentBalance < TOKENS_PER_CALL) {
      return jsonResponse(
        {
          error: "Insufficient tokens",
          balance: currentBalance,
          required: TOKENS_PER_CALL,
        },
        402,
      );
    }

    const updatedBalance = currentBalance - TOKENS_PER_CALL;
    const lifetimeUsed = Number(profile.lifetime_tokens_used ?? 0) + TOKENS_PER_CALL;

    const { error: updateError } = await admin
      .from("user_profiles")
      .update({
        token_balance: updatedBalance,
        lifetime_tokens_used: lifetimeUsed,
      })
      .eq("id", user.id);

    if (updateError) {
      return jsonResponse(
        {
          error: "Failed to deduct tokens",
          details: `${error.message} | fallback profile update failed: ${updateError.message}`,
        },
        500,
      );
    }

    // Best effort transaction log in fallback mode.
    await admin.from("token_transactions").insert({
      user_id: user.id,
      type: "debit",
      amount: TOKENS_PER_CALL,
      balance_after: updatedBalance,
      description: "Dummy protected API call",
      endpoint: "/functions/v1/token-check-demo",
    });

    return jsonResponse({
      success: true,
      message: `Token check passed. ${TOKENS_PER_CALL} tokens deducted.`,
      userId: user.id,
      deducted: TOKENS_PER_CALL,
      balance: updatedBalance,
      mode: "fallback-manual",
    });
  }

  if (error) {
    return jsonResponse(
      {
        error: "Failed to deduct tokens",
        details: error.message,
      },
      500,
    );
  }

  if (!data?.success) {
    return jsonResponse(
      {
        error: data?.error ?? "Insufficient tokens",
        balance: data?.balance,
        required: TOKENS_PER_CALL,
      },
      402,
    );
  }

  return jsonResponse({
    success: true,
    message: `Token check passed. ${TOKENS_PER_CALL} tokens deducted.`,
    userId: user.id,
    deducted: data?.deducted ?? TOKENS_PER_CALL,
    balance: data?.balance ?? null,
    mode: "rpc",
  });
});
