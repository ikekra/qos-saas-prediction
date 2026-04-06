import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

type TopupBody = {
  tokensAdded?: number;
  amountPaid?: number;
  packageSelected?: string;
  fullName?: string;
  email?: string;
  notes?: string;
  billingAddress?: string;
  gstId?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed. Use POST." }, 405, req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !serviceRole) {
    return jsonResponse({ error: "Supabase environment is not configured." }, 500, req);
  }

  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401, req);

    const body = (await req.json().catch(() => ({}))) as TopupBody;
    const tokensAdded = Number(body.tokensAdded ?? 0);
    const amountPaid = Number(body.amountPaid ?? 0);

    if (!Number.isFinite(tokensAdded) || tokensAdded <= 0) {
      return jsonResponse({ error: "tokensAdded must be a positive number." }, 400, req);
    }
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      return jsonResponse({ error: "amountPaid must be a positive number." }, 400, req);
    }

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim();
    if (!fullName || !email) return jsonResponse({ error: "fullName and email are required." }, 400, req);
    const safeEmail = email || user.email || `${user.id}@local.user`;

    const admin = createClient(supabaseUrl, serviceRole);

    const { data: initialProfile, error: profileErr } = await admin
      .from("user_profiles")
      .select("token_balance")
      .eq("id", user.id)
      .maybeSingle();
    let profile = initialProfile;

    if (profileErr) return jsonResponse({ error: "Could not load profile", details: profileErr.message }, 500, req);
    if (!profile) {
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
          { error: "Could not initialize user profile", details: createProfileError.message },
          500,
          req,
        );
      }

      const { data: createdProfile, error: createdProfileError } = await admin
        .from("user_profiles")
        .select("token_balance")
        .eq("id", user.id)
        .maybeSingle();
      if (createdProfileError || !createdProfile) {
        return jsonResponse(
          { error: "Profile not found after initialization", details: createdProfileError?.message },
          500,
          req,
        );
      }
      profile = createdProfile;
    }

    const currentBalance = Number(profile.token_balance ?? 0);
    const newBalance = currentBalance + tokensAdded;

    const { data: topupRow, error: topupErr } = await admin
      .from("topup_records")
      .insert({
        user_id: user.id,
        full_name: fullName,
        email,
        account_user_id: user.id,
        tokens_added: tokensAdded,
        amount_paid: amountPaid,
        currency: "INR",
        package_selected: body.packageSelected ?? "custom",
        notes: body.notes ?? null,
        billing_address: body.billingAddress ?? null,
        gst_id: body.gstId ?? null,
        status: "completed",
        payment_method: "manual",
      })
      .select("id")
      .single();

    if (topupErr) return jsonResponse({ error: "Could not save topup record", details: topupErr.message }, 500, req);

    const { error: updateErr } = await admin
      .from("user_profiles")
      .update({ token_balance: newBalance })
      .eq("id", user.id);

    if (updateErr) return jsonResponse({ error: "Could not update balance", details: updateErr.message }, 500, req);

    const { data: txRow, error: txErr } = await admin
      .from("token_transactions")
      .insert({
        user_id: user.id,
        type: "credit",
        amount: tokensAdded,
        balance_after: newBalance,
        description: "Manual token top-up",
        endpoint: "/functions/v1/token-topup",
      })
      .select("id")
      .single();

    if (txErr) return jsonResponse({ error: "Could not create transaction", details: txErr.message }, 500, req);

    return jsonResponse(
      {
        success: true,
        newBalance,
        transactionId: txRow?.id ?? null,
        topupId: topupRow?.id ?? null,
      },
      200,
      req,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500, req);
  }
});
