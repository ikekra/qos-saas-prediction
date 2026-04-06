import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireAdminContext } from "../_shared/admin-rbac.ts";
import { insertAdminAuditLog } from "../_shared/admin-audit.ts";

type AdminAction = "verify" | "suspend" | "reactivate" | "reject";

type UserProfileRow = {
  id: string;
  email: string | null;
  token_balance: number | null;
  lifetime_tokens_used: number | null;
};

const OWNER_EMAIL = "chagankekra13@gmail.com";

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

const derivePlan = (tokens: number) => {
  if (tokens >= 100000) return "Enterprise";
  if (tokens >= 25000) return "Pro";
  if (tokens >= 5000) return "Basic";
  if (tokens > 500) return "Student";
  return "Free";
};

const deriveStatus = (user: { banned_until?: string | null; email_confirmed_at?: string | null }, tokens: number) => {
  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) return "Suspended";
  if (!user.email_confirmed_at) return "Pending";
  if (tokens < 100) return "Low tokens";
  return "Active";
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
      const search = normalize(url.searchParams.get("search"));
      const plan = normalize(url.searchParams.get("plan"));
      const limit = Math.min(200, Math.max(10, asNumber(url.searchParams.get("limit"), 100)));

      const { data: authUsers, error: listError } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (listError) return jsonResponse({ error: "Failed to list users", details: listError.message }, 500, req);

      const users = authUsers?.users ?? [];
      const userIds = users.map((u) => u.id);

      const { data: profiles, error: profilesErr } = await adminClient
        .from("user_profiles")
        .select("id, email, token_balance, lifetime_tokens_used")
        .in("id", userIds);

      if (profilesErr) return jsonResponse({ error: "Failed to load profiles", details: profilesErr.message }, 500, req);

      const profileMap = new Map<string, UserProfileRow>((profiles ?? []).map((row) => [row.id, row as UserProfileRow]));

      const rows = users
        .map((authUser) => {
          const profile = profileMap.get(authUser.id);
          const email = authUser.email ?? profile?.email ?? "";
          const name =
            (authUser.user_metadata?.name as string | undefined)?.trim() ||
            email.split("@")[0] ||
            "User";
          const tokens = asNumber(profile?.token_balance, 0);
          const planLabel = derivePlan(tokens);
          const status = deriveStatus(
            {
              banned_until: authUser.banned_until,
              email_confirmed_at: authUser.email_confirmed_at,
            },
            tokens,
          );

          return {
            id: authUser.id,
            name,
            email,
            plan: planLabel,
            tokens,
            status,
            email_verified: Boolean(authUser.email_confirmed_at),
            banned_until: authUser.banned_until ?? null,
            created_at: authUser.created_at ?? null,
            is_owner: normalize(email) === OWNER_EMAIL,
          };
        })
        .filter((row) => {
          if (search) {
            const text = `${row.name} ${row.email} ${row.id} ${row.plan}`.toLowerCase();
            if (!text.includes(search)) return false;
          }
          if (plan && plan !== "all" && normalize(row.plan) !== plan) return false;
          return true;
        })
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, limit);

      const summary = {
        total_users: rows.length,
        active_users: rows.filter((r) => r.status === "Active").length,
        pending_users: rows.filter((r) => r.status === "Pending").length,
        suspended_users: rows.filter((r) => r.status === "Suspended").length,
      };

      const { data: tokenSummaryData } = await adminClient.rpc("get_token_admin_summary");
      const tokenSummaryRow = Array.isArray(tokenSummaryData) ? tokenSummaryData[0] : tokenSummaryData;

      const { data: services, error: servicesErr } = await adminClient
        .from("web_services")
        .select("id, name, provider, category, is_active, updated_at")
        .order("updated_at", { ascending: false })
        .limit(200);

      if (servicesErr) return jsonResponse({ error: "Failed to load services", details: servicesErr.message }, 500, req);

      const serviceRows = (services ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        provider: s.provider,
        category: s.category,
        is_active: Boolean(s.is_active),
        updated_at: s.updated_at,
      }));

      const servicesSummary = {
        total_services: serviceRows.length,
        active_services: serviceRows.filter((s) => s.is_active).length,
        inactive_services: serviceRows.filter((s) => !s.is_active).length,
      };

      const { data: recentAudit, error: recentAuditErr } = await adminClient
        .from("admin_audit_logs")
        .select("id, created_at, actor_email, action, target_email, target_user_id, status, reason")
        .order("created_at", { ascending: false })
        .limit(20);

      if (recentAuditErr) {
        return jsonResponse({ error: "Failed to load audit logs", details: recentAuditErr.message }, 500, req);
      }

      return jsonResponse(
        {
          success: true,
          summary,
          token_summary: {
            total_token_balance: asNumber(tokenSummaryRow?.total_token_balance, 0),
            total_lifetime_tokens_used: asNumber(tokenSummaryRow?.total_lifetime_tokens_used, 0),
          },
          services_summary: servicesSummary,
          users: rows,
          services: serviceRows.slice(0, 80),
          recent_audit: recentAudit ?? [],
        },
        200,
        req,
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      target_user_id?: string;
      action?: AdminAction;
      reason?: string;
    };

    const targetUserId = String(body.target_user_id ?? "").trim();
    const action = String(body.action ?? "").trim() as AdminAction;
    const reason = String(body.reason ?? "").trim() || "Admin user management action";

    if (!targetUserId) return jsonResponse({ error: "target_user_id is required" }, 400, req);
    if (!["verify", "suspend", "reactivate", "reject"].includes(action)) {
      return jsonResponse({ error: "action must be verify/suspend/reactivate/reject" }, 400, req);
    }
    if (targetUserId === user.id) {
      return jsonResponse({ error: "Owner self-action is blocked for safety." }, 400, req);
    }

    const { data: targetData, error: targetErr } = await adminClient.auth.admin.getUserById(targetUserId);
    if (targetErr || !targetData?.user) {
      return jsonResponse({ error: "Target user not found", details: targetErr?.message }, 404, req);
    }
    const targetUser = targetData.user;
    const targetEmail = targetUser.email ?? null;

    await insertAdminAuditLog(adminClient, {
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: `user_${action}`,
      resource: "user_account",
      target_user_id: targetUserId,
      target_email: targetEmail,
      status: "attempt",
      request_id: requestId,
      ip_address: ipAddress,
      user_agent: userAgent,
      reason,
      metadata: { action },
    });

    let updateError: { message: string } | null = null;
    if (action === "verify") {
      const updatedMeta = {
        ...(targetUser.user_metadata ?? {}),
        admin_verified: true,
      };
      const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
        user_metadata: updatedMeta,
      });
      updateError = error;
    } else if (action === "suspend" || action === "reject") {
      const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: "876000h",
      });
      updateError = error;
    } else if (action === "reactivate") {
      const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: "none",
      });
      updateError = error;
    }

    if (updateError) {
      await insertAdminAuditLog(adminClient, {
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: `user_${action}`,
        resource: "user_account",
        target_user_id: targetUserId,
        target_email: targetEmail,
        status: "failed",
        request_id: requestId,
        ip_address: ipAddress,
        user_agent: userAgent,
        reason: `${reason} (failed: ${updateError.message})`,
        metadata: { action },
      });
      return jsonResponse({ error: "Failed to apply action", details: updateError.message }, 500, req);
    }

    await insertAdminAuditLog(adminClient, {
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: `user_${action}`,
      resource: "user_account",
      target_user_id: targetUserId,
      target_email: targetEmail,
      status: "success",
      request_id: requestId,
      ip_address: ipAddress,
      user_agent: userAgent,
      reason,
      metadata: { action },
    });

    return jsonResponse({ success: true, target_user_id: targetUserId, action }, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500, req);
  }
});
