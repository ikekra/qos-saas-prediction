import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireAdminContext } from "../_shared/admin-rbac.ts";
import { insertAdminAuditLog } from "../_shared/admin-audit.ts";

// Safe number parsing helper
const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (!["GET", "POST"].includes(req.method)) {
    return jsonResponse({ error: "Method not allowed. Use GET or POST." }, 405, req);
  }

  const auth = await requireAdminContext(req, { requireOwner: true });
  if (auth.response) return auth.response;
  if (!auth.context) return jsonResponse({ error: "Unauthorized" }, 401, req);

  const { user, adminClient } = auth.context;
  const requestId = req.headers.get("x-idempotency-key")?.trim() || crypto.randomUUID();
  const ipAddress = req.headers.get("x-forwarded-for")?.trim() ?? null;
  const userAgent = req.headers.get("user-agent")?.trim() ?? null;

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
      const limit = Math.min(200, Math.max(10, asNumber(url.searchParams.get("limit"), 80)));

      // Fetch token summary
      const { data: summaryData, error: summaryError } = await adminClient.rpc("get_token_admin_summary");
      if (summaryError) {
        console.error("Summary RPC error:", summaryError);
        return jsonResponse({ error: "Failed to load token summary", details: summaryError.message }, 500, req);
      }

      const summaryRow = Array.isArray(summaryData) ? summaryData[0] : summaryData;

      // Fetch user profiles
      const { data: profiles, error: profileErr } = await adminClient
        .from("user_profiles")
        .select("id, email, token_balance, lifetime_tokens_used, updated_at")
        .order("token_balance", { ascending: false })
        .limit(limit);

      if (profileErr) {
        console.error("Profile fetch error:", profileErr);
        return jsonResponse({ error: "Failed to load user balances", details: profileErr.message }, 500, req);
      }

      // Fetch audit logs
      const { data: recentAudit, error: recentAuditErr } = await adminClient
        .from("admin_audit_logs")
        .select("id, created_at, actor_email, action, target_email, target_user_id, status, before_value, after_value, delta_value, reason")
        .order("created_at", { ascending: false })
        .limit(40);

      if (recentAuditErr) {
        console.error("Audit log fetch error:", recentAuditErr);
        return jsonResponse({ error: "Failed to load admin audit logs", details: recentAuditErr.message }, 500, req);
      }

      // Filter profiles based on search
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
          audit_logs: recentAudit ?? [],
        },
        200,
        req,
      );
    }

    // POST handler
    const body = (await req.json().catch(() => ({}))) as {
      target_user_id?: string;
      mode?: "set" | "add" | "deduct";
      amount?: number;
      note?: string;
      confirm_override?: string;
    };

    if ((body.confirm_override ?? "").trim() !== "CONFIRM_OVERRIDE") {
      await insertAdminAuditLog(adminClient, {
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: "token_override_from_console",
        resource: "token_balance",
        status: "denied",
        request_id: requestId,
        ip_address: ipAddress,
        user_agent: userAgent,
        reason: "Missing CONFIRM_OVERRIDE phrase",
        confirm_phrase: body.confirm_override ?? null,
        metadata: { reason_code: "confirm_override_missing" },
      });
      return jsonResponse({ error: "Missing confirmation phrase. Send confirm_override='CONFIRM_OVERRIDE'." }, 400, req);
    }

    const targetUserId = String(body.target_user_id ?? "").trim();
    const mode = body.mode;
    const amount = Math.floor(asNumber(body.amount, 0));
    const note = String(body.note ?? "").trim() || "Owner token adjustment";

    if (!targetUserId) return jsonResponse({ error: "target_user_id is required" }, 400, req);
    if (!["set", "add", "deduct"].includes(String(mode))) return jsonResponse({ error: "mode must be set/add/deduct" }, 400, req);
    if (!Number.isFinite(amount) || amount < 0) return jsonResponse({ error: "amount must be a non-negative integer" }, 400, req);

    const { data: targetProfile, error: targetErr } = await adminClient
      .from("user_profiles")
      .select("id, email, token_balance")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetErr) return jsonResponse({ error: "Failed to load target user", details: targetErr.message }, 500, req);

    let currentBalance = asNumber(targetProfile?.token_balance, 0);
    let targetEmail = targetProfile?.email ?? null;
    if (!targetProfile) {
      const { data: authUser } = await adminClient.auth.admin.getUserById(targetUserId);
      targetEmail = authUser?.user?.email ?? `${targetUserId}@local.user`;
      const { error: initErr } = await adminClient.from("user_profiles").upsert(
        {
          id: targetUserId,
          email: targetEmail,
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
    const delta = nextBalance - currentBalance;

    await insertAdminAuditLog(adminClient, {
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "token_override_from_console",
      resource: "token_balance",
      target_user_id: targetUserId,
      target_email: targetEmail,
      status: "attempt",
      request_id: requestId,
      ip_address: ipAddress,
      user_agent: userAgent,
      before_value: currentBalance,
      after_value: nextBalance,
      delta_value: delta,
      reason: note,
      confirm_phrase: body.confirm_override ?? null,
      metadata: { mode, amount },
    });

    const { error: updateErr } = await adminClient
      .from("user_profiles")
      .update({ token_balance: nextBalance })
      .eq("id", targetUserId);

    if (updateErr) {
      await insertAdminAuditLog(adminClient, {
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: "token_override_from_console",
        resource: "token_balance",
        target_user_id: targetUserId,
        target_email: targetEmail,
        status: "failed",
        request_id: requestId,
        ip_address: ipAddress,
        user_agent: userAgent,
        before_value: currentBalance,
        after_value: nextBalance,
        delta_value: delta,
        reason: `${note} (update failed: ${updateErr.message})`,
        confirm_phrase: body.confirm_override ?? null,
        metadata: { mode, amount },
      });
      return jsonResponse({ error: "Failed to update target balance", details: updateErr.message }, 500, req);
    }

    if (delta !== 0) {
      const txType = delta > 0 ? "credit" : "debit";
      const { error: txErr } = await adminClient
        .from("token_transactions")
        .insert({
          user_id: targetUserId,
          type: txType,
          amount: Math.abs(delta),
          balance_after: nextBalance,
          description: `${note} by owner ${user.email ?? user.id}`,
          endpoint: "/functions/v1/admin-token-console",
        });
      if (txErr) return jsonResponse({ error: "Balance updated but failed to write transaction", details: txErr.message }, 500, req);
    }

    await insertAdminAuditLog(adminClient, {
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "token_override_from_console",
      resource: "token_balance",
      target_user_id: targetUserId,
      target_email: targetEmail,
      status: "success",
      request_id: requestId,
      ip_address: ipAddress,
      user_agent: userAgent,
      before_value: currentBalance,
      after_value: nextBalance,
      delta_value: delta,
      reason: note,
      confirm_phrase: body.confirm_override ?? null,
      metadata: { mode, amount },
    });

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
