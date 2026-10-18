import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { insertAdminAuditLog } from "../_shared/admin-audit.ts";
import { requireAdminContext } from "../_shared/admin-rbac.ts";

type OverrideMode = "set" | "add" | "deduct";

type TokenOverrideItem = {
  target_user_id: string;
  mode: OverrideMode;
  amount: number;
  reason?: string;
};

type OverrideRequestBody = {
  target_user_id?: string;
  mode?: OverrideMode;
  amount?: number;
  reason?: string;
  confirm_override?: string;
  confirm_bulk?: string;
  overrides?: TokenOverrideItem[];
};

const CONFIRM_OVERRIDE = "CONFIRM_OVERRIDE";
const CONFIRM_BULK_50 = "CONFIRM_BULK_50";

const asInt = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return NaN;
  return Math.floor(parsed);
};

const computeNextBalance = (currentBalance: number, mode: OverrideMode, amount: number) => {
  if (mode === "set") return amount;
  if (mode === "add") return currentBalance + amount;
  return Math.max(0, currentBalance - amount);
};

const headerValue = (req: Request, name: string) => req.headers.get(name)?.trim() ?? null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed. Use POST." }, 405, req);

  const auth = await requireAdminContext(req, { requireOwner: true });
  if (auth.response) return auth.response;
  if (!auth.context) return jsonResponse({ error: "Unauthorized" }, 401, req);

  const { user, adminClient } = auth.context;
  const requestId = headerValue(req, "x-idempotency-key") ?? crypto.randomUUID();
  const ipAddress = headerValue(req, "x-forwarded-for");
  const userAgent = headerValue(req, "user-agent");

  let body: OverrideRequestBody;
  try {
    body = (await req.json()) as OverrideRequestBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, req);
  }

  if ((body.confirm_override ?? "").trim() !== CONFIRM_OVERRIDE) {
    await insertAdminAuditLog(adminClient, {
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "token_override_request",
      resource: "token_balance",
      status: "denied",
      request_id: requestId,
      ip_address: ipAddress,
      user_agent: userAgent,
      reason: "Missing CONFIRM_OVERRIDE phrase",
      confirm_phrase: body.confirm_override ?? null,
      metadata: { reason_code: "confirm_override_missing" },
    });

    return jsonResponse(
      { error: "Missing confirmation phrase. Send confirm_override='CONFIRM_OVERRIDE'." },
      400,
      req,
    );
  }

  const overrides =
    Array.isArray(body.overrides) && body.overrides.length > 0
      ? body.overrides
      : [
          {
            target_user_id: String(body.target_user_id ?? "").trim(),
            mode: body.mode as OverrideMode,
            amount: asInt(body.amount),
            reason: body.reason,
          },
        ];

  if (overrides.length === 0) {
    return jsonResponse({ error: "No overrides provided" }, 400, req);
  }

  if (overrides.length >= 50 && (body.confirm_bulk ?? "").trim() !== CONFIRM_BULK_50) {
    await insertAdminAuditLog(adminClient, {
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "token_override_bulk",
      resource: "token_balance",
      status: "denied",
      request_id: requestId,
      ip_address: ipAddress,
      user_agent: userAgent,
      reason: "Missing CONFIRM_BULK_50 phrase for bulk operation",
      confirm_phrase: body.confirm_bulk ?? null,
      bulk_count: overrides.length,
      metadata: { reason_code: "confirm_bulk_missing" },
    });

    return jsonResponse(
      { error: "Bulk override requires confirm_bulk='CONFIRM_BULK_50' for 50+ users." },
      400,
      req,
    );
  }

  for (const [index, item] of overrides.entries()) {
    if (!item.target_user_id?.trim()) {
      return jsonResponse({ error: `overrides[${index}].target_user_id is required` }, 400, req);
    }
    if (!["set", "add", "deduct"].includes(String(item.mode))) {
      return jsonResponse({ error: `overrides[${index}].mode must be set/add/deduct` }, 400, req);
    }
    if (!Number.isFinite(item.amount) || item.amount < 0) {
      return jsonResponse({ error: `overrides[${index}].amount must be a non-negative integer` }, 400, req);
    }
  }

  const uniqueUserIds = [...new Set(overrides.map((item) => item.target_user_id.trim()))];

  const { data: existingProfiles, error: existingErr } = await adminClient
    .from("user_profiles")
    .select("id, email, token_balance")
    .in("id", uniqueUserIds);

  if (existingErr) {
    return jsonResponse({ error: "Failed to load target user profiles", details: existingErr.message }, 500, req);
  }

  const profileMap = new Map(
    (existingProfiles ?? []).map((row) => [row.id, row as { id: string; email: string | null; token_balance: number | null }]),
  );

  const results: Array<{
    target_user_id: string;
    mode: OverrideMode;
    amount: number;
    balance_before: number;
    balance_after: number;
    delta: number;
  }> = [];

  for (const item of overrides) {
    const targetUserId = item.target_user_id.trim();
    let profile = profileMap.get(targetUserId) ?? null;

    if (!profile) {
      const { data: authUserData } = await adminClient.auth.admin.getUserById(targetUserId);
      const fallbackEmail = authUserData?.user?.email ?? `${targetUserId}@local.user`;
      const { error: initError } = await adminClient.from("user_profiles").upsert(
        {
          id: targetUserId,
          email: fallbackEmail,
          token_balance: 0,
          lifetime_tokens_used: 0,
        },
        { onConflict: "id" },
      );
      if (initError) {
        await insertAdminAuditLog(adminClient, {
          actor_user_id: user.id,
          actor_email: user.email ?? null,
          action: "token_override_apply",
          resource: "token_balance",
          target_user_id: targetUserId,
          target_email: fallbackEmail,
          status: "failed",
          request_id: requestId,
          ip_address: ipAddress,
          user_agent: userAgent,
          reason: `Failed to initialize user profile: ${initError.message}`,
          confirm_phrase: CONFIRM_OVERRIDE,
          bulk_count: overrides.length,
          metadata: { mode: item.mode, amount: item.amount },
        });
        return jsonResponse({ error: "Failed to initialize target profile", details: initError.message }, 500, req);
      }

      profile = {
        id: targetUserId,
        email: fallbackEmail,
        token_balance: 0,
      };
      profileMap.set(targetUserId, profile);
    }

    const currentBalance = asInt(profile.token_balance ?? 0);
    const nextBalance = computeNextBalance(currentBalance, item.mode, item.amount);
    const delta = nextBalance - currentBalance;
    const reason = (item.reason ?? "").trim() || "Owner token override";

    await insertAdminAuditLog(adminClient, {
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "token_override_apply",
      resource: "token_balance",
      target_user_id: targetUserId,
      target_email: profile.email,
      status: "attempt",
      request_id: requestId,
      ip_address: ipAddress,
      user_agent: userAgent,
      before_value: currentBalance,
      after_value: nextBalance,
      delta_value: delta,
      reason,
      confirm_phrase: CONFIRM_OVERRIDE,
      bulk_count: overrides.length,
      metadata: {
        mode: item.mode,
        amount: item.amount,
      },
    });

    const { error: updateErr } = await adminClient
      .from("user_profiles")
      .update({ token_balance: nextBalance })
      .eq("id", targetUserId);

    if (updateErr) {
      await insertAdminAuditLog(adminClient, {
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: "token_override_apply",
        resource: "token_balance",
        target_user_id: targetUserId,
        target_email: profile.email,
        status: "failed",
        request_id: requestId,
        ip_address: ipAddress,
        user_agent: userAgent,
        before_value: currentBalance,
        after_value: nextBalance,
        delta_value: delta,
        reason: `${reason} (update failed: ${updateErr.message})`,
        confirm_phrase: CONFIRM_OVERRIDE,
        bulk_count: overrides.length,
        metadata: { mode: item.mode, amount: item.amount },
      });
      return jsonResponse({ error: "Failed to update target balance", details: updateErr.message }, 500, req);
    }

    if (delta !== 0) {
      const { error: txErr } = await adminClient.from("token_transactions").insert({
        user_id: targetUserId,
        type: delta > 0 ? "credit" : "debit",
        amount: Math.abs(delta),
        balance_after: nextBalance,
        description: `${reason} by owner ${user.email ?? user.id}`,
        endpoint: "/functions/v1/admin-token-override",
      });

      if (txErr) {
        await insertAdminAuditLog(adminClient, {
          actor_user_id: user.id,
          actor_email: user.email ?? null,
          action: "token_override_apply",
          resource: "token_balance",
          target_user_id: targetUserId,
          target_email: profile.email,
          status: "failed",
          request_id: requestId,
          ip_address: ipAddress,
          user_agent: userAgent,
          before_value: currentBalance,
          after_value: nextBalance,
          delta_value: delta,
          reason: `${reason} (token transaction failed: ${txErr.message})`,
          confirm_phrase: CONFIRM_OVERRIDE,
          bulk_count: overrides.length,
          metadata: { mode: item.mode, amount: item.amount },
        });
        return jsonResponse(
          { error: "Balance updated but failed to write token transaction", details: txErr.message },
          500,
          req,
        );
      }
    }

    await insertAdminAuditLog(adminClient, {
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: "token_override_apply",
      resource: "token_balance",
      target_user_id: targetUserId,
      target_email: profile.email,
      status: "success",
      request_id: requestId,
      ip_address: ipAddress,
      user_agent: userAgent,
      before_value: currentBalance,
      after_value: nextBalance,
      delta_value: delta,
      reason,
      confirm_phrase: CONFIRM_OVERRIDE,
      bulk_count: overrides.length,
      metadata: { mode: item.mode, amount: item.amount },
    });

    profileMap.set(targetUserId, { ...profile, token_balance: nextBalance });
    results.push({
      target_user_id: targetUserId,
      mode: item.mode,
      amount: item.amount,
      balance_before: currentBalance,
      balance_after: nextBalance,
      delta,
    });
  }

  return jsonResponse(
    {
      success: true,
      request_id: requestId,
      overrides_applied: results.length,
      results,
    },
    200,
    req,
  );
});
