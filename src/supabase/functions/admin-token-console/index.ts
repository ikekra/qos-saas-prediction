import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type User } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isProjectOwner = (user: User) => {
  const role = user.app_metadata?.role;
  if (role !== "admin") return false;

  const ownerId = (Deno.env.get("PROJECT_OWNER_USER_ID") ?? "").trim();
  const ownerEmail = (Deno.env.get("PROJECT_OWNER_EMAIL") ?? "").trim().toLowerCase();

  if (ownerId) return user.id === ownerId;
  if (ownerEmail) return (user.email ?? "").toLowerCase() === ownerEmail;

  return true;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (!["GET", "POST"].includes(req.method)) return jsonResponse({ error: "Method not allowed. Use GET or POST." }, 405, req);

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
    const admin = createClient(supabaseUrl, serviceRole);

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401, req);
    if (!isProjectOwner(user)) return jsonResponse({ error: "Forbidden. Project owner access only." }, 403, req);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
      const limit = Math.min(200, Math.max(10, asNumber(url.searchParams.get("limit"), 80)));

      const { data: summaryData, error: summaryError } = await admin.rpc("get_token_admin_summary");
      if (summaryError) {
        return jsonResponse({ error: "Failed to load token summary", details: summaryError.message }, 500, req);
      }

      const summaryRow = Array.isArray(summaryData) ? summaryData[0] : summaryData;

      const { data: profiles, error: profileErr } = await admin
        .from("user_profiles")
        .select("id, email, token_balance, lifetime_tokens_used, updated_at")
        .order("token_balance", { ascending: false })
        .limit(limit);

      if (profileErr) return jsonResponse({ error: "Failed to load user balances", details: profileErr.message }, 500, req);

      const filtered = (profiles ?? []).filter((row) => {
        if (!search) return true;
        return row.id.toLowerCase().includes(search) || (row.email ?? "").toLowerCase().includes(search);
      });

      return jsonResponse(
        {
          success: true,
          summary: {
            total_users: asNumber(summaryRow?.total_users),
            total_token_balance: asNumber(summaryRow?.total_token_balance),
            total_lifetime_tokens_used: asNumber(summaryRow?.total_lifetime_tokens_used),
          },
          users: filtered,
        },
        200,
        req,
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      target_user_id?: string;
      mode?: "set" | "add" | "deduct";
      amount?: number;
      note?: string;
    };

    const targetUserId = String(body.target_user_id ?? "").trim();
    const mode = body.mode;
    const amount = Math.floor(asNumber(body.amount, 0));
    const note = String(body.note ?? "").trim() || "Owner token adjustment";

    if (!targetUserId) return jsonResponse({ error: "target_user_id is required" }, 400, req);
    if (!["set", "add", "deduct"].includes(String(mode))) return jsonResponse({ error: "mode must be set/add/deduct" }, 400, req);
    if (!Number.isFinite(amount) || amount < 0) return jsonResponse({ error: "amount must be a non-negative integer" }, 400, req);

    const { data: targetProfile, error: targetErr } = await admin
      .from("user_profiles")
      .select("id, email, token_balance")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetErr) return jsonResponse({ error: "Failed to load target user", details: targetErr.message }, 500, req);

    let currentBalance = asNumber(targetProfile?.token_balance, 0);
    if (!targetProfile) {
      const { data: authUser } = await admin.auth.admin.getUserById(targetUserId);
      const email = authUser?.user?.email ?? `${targetUserId}@local.user`;
      const { error: initErr } = await admin.from("user_profiles").upsert(
        {
          id: targetUserId,
          email,
          token_balance: 0,
          lifetime_tokens_used: 0,
        },
        { onConflict: "id" },
      );
      if (initErr) return jsonResponse({ error: "Failed to initialize target profile", details: initErr.message }, 500, req);
      currentBalance = 0;
    }

    let nextBalance = currentBalance;
    if (mode === "set") nextBalance = amount;
    if (mode === "add") nextBalance = currentBalance + amount;
    if (mode === "deduct") nextBalance = Math.max(0, currentBalance - amount);

    const { error: updateErr } = await admin
      .from("user_profiles")
      .update({ token_balance: nextBalance })
      .eq("id", targetUserId);
    if (updateErr) return jsonResponse({ error: "Failed to update target balance", details: updateErr.message }, 500, req);

    const delta = Math.abs(nextBalance - currentBalance);
    if (delta > 0) {
      const txType = nextBalance >= currentBalance ? "credit" : "debit";
      const { error: txErr } = await admin
        .from("token_transactions")
        .insert({
          user_id: targetUserId,
          type: txType,
          amount: delta,
          balance_after: nextBalance,
          description: `${note} by owner ${user.email ?? user.id}`,
          endpoint: "/functions/v1/admin-token-console",
        });
      if (txErr) return jsonResponse({ error: "Balance updated but failed to write transaction", details: txErr.message }, 500, req);
    }

    return jsonResponse(
      {
        success: true,
        target_user_id: targetUserId,
        balance_before: currentBalance,
        balance_after: nextBalance,
      },
      200,
      req,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500, req);
  }
});
