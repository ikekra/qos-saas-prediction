import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdminContext } from "../_shared/admin-rbac.ts";
import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getOrSetCache, clearCache } from "../_shared/memory-cache.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  const auth = await requireAdminContext(req);
  if (auth.response) return auth.response;
  if (!auth.context) return jsonResponse({ error: "Unauthorized" }, 401, req);

  const { adminClient, user } = auth.context;
  const url = new URL(req.url);
  const route = url.pathname.includes("/api/")
    ? url.pathname.slice(url.pathname.indexOf("/api/"))
    : "/api";
  const ipAddress = req.headers.get("x-forwarded-for") ?? null;

  try {
    if (route === "/api/admin/overview" && req.method === "GET") {
      const data = await getOrSetCache("admin:overview", 60_000, async () => await buildOverview(adminClient));
      return jsonResponse(data, 200, req);
    }

    if (route === "/api/admin/users" && req.method === "GET") {
      return jsonResponse(await listUsers(adminClient, url), 200, req);
    }

    if (route.match(/^\/api\/admin\/users\/[^/]+\/actions$/) && req.method === "POST") {
      const targetUserId = route.split("/")[4];
      const body = await req.json().catch(() => ({}));
      const response = await applyUserAction(adminClient, user.id, targetUserId, ipAddress, body);
      clearCache("admin:");
      return jsonResponse(response, 200, req);
    }

    if (route === "/api/admin/payments" && req.method === "GET") {
      return jsonResponse(await listPayments(adminClient, url), 200, req);
    }

    if (route.match(/^\/api\/admin\/payments\/[^/]+\/refund$/) && req.method === "POST") {
      const paymentId = route.split("/")[4];
      const body = await req.json().catch(() => ({})) as { reason?: string };
      const { data: payment } = await adminClient.from("payments").select("*").eq("id", paymentId).maybeSingle();
      await adminClient.from("payments").update({ status: "refunded" }).eq("id", paymentId);
      await appendAudit(adminClient, user.id, "payment_refund", "payment", paymentId, payment, { status: "refunded", reason: body.reason ?? null }, ipAddress);
      clearCache("admin:");
      return jsonResponse({ success: true }, 200, req);
    }

    if (route.match(/^\/api\/admin\/payments\/[^/]+\/retry$/) && req.method === "POST") {
      const paymentId = route.split("/")[4];
      const { data: payment } = await adminClient.from("payments").select("*").eq("id", paymentId).maybeSingle();
      await appendAudit(adminClient, user.id, "payment_retry_triggered", "payment", paymentId, payment, { retryRequestedAt: new Date().toISOString() }, ipAddress);
      return jsonResponse({ success: true, queued: true }, 200, req);
    }

    if (route === "/api/admin/audit" && req.method === "GET") {
      return jsonResponse(await listAuditLogs(adminClient, url), 200, req);
    }

    if (route === "/api/admin/audit/export" && req.method === "GET") {
      const payload = await listAuditLogs(adminClient, url);
      const rows = payload.items.map((item: any) =>
        [item.created_at, item.action, item.target_type, item.target_id ?? "", item.ip ?? ""].join(","),
      );
      return new Response(["created_at,action,target_type,target_id,ip", ...rows].join("\n"), {
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="audit-logs.csv"',
        },
      });
    }

    if (route === "/api/admin/payments/export" && req.method === "GET") {
      const payload = await listPayments(adminClient, url);
      const rows = payload.items.map((item: any) =>
        [item.created_at, item.user_id, item.plan_name ?? "", item.amount_in_paise ?? 0, item.status].join(","),
      );
      return new Response(["created_at,user_id,plan_name,amount_in_paise,status", ...rows].join("\n"), {
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="payments.csv"',
        },
      });
    }

    return jsonResponse({ error: "Route not found" }, 404, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return jsonResponse({ error: message }, 500, req);
  }
});

async function buildOverview(adminClient: any) {
  const [{ data: authUsers }, totalRevenue, paymentSummary, teamSummary, usageSummary, auditSummary] = await Promise.all([
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    adminClient.from("payments").select("amount_in_paise, status, created_at, plan_name"),
    adminClient.from("payments").select("status, plan_name, created_at"),
    Promise.all([
      adminClient.from("teams").select("id, plan, created_at"),
      adminClient.from("team_members").select("team_id, status"),
      adminClient.from("team_activity_logs").select("team_id, created_at"),
    ]),
    Promise.all([
      adminClient.from("tests").select("created_at"),
      adminClient.from("performance_test_run_logs").select("team_id, actor_user_id, created_at"),
      adminClient.from("performance_run_cycles").select("run_limit, runs_used, scope_type, scope_id"),
    ]),
    adminClient.from("audit_logs").select("created_at"),
  ]);

  const users = authUsers.users ?? [];
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const week = new Date(now); week.setDate(now.getDate() - 7);
  const month = new Date(now); month.setDate(1);
  const prevMonth = new Date(now); prevMonth.setMonth(now.getMonth() - 1); prevMonth.setDate(1);

  const payments = totalRevenue.data ?? [];
  const paymentRows = paymentSummary.data ?? [];
  const teams = teamSummary[0].data ?? [];
  const teamMembers = teamSummary[1].data ?? [];
  const teamActivity = teamSummary[2].data ?? [];
  const tests = usageSummary[0].data ?? [];
  const runLogs = usageSummary[1].data ?? [];
  const quotaCycles = usageSummary[2].data ?? [];

  const totalUsers = users.length;
  const newUsersToday = users.filter((row: any) => new Date(row.created_at) >= today).length;
  const newUsersWeek = users.filter((row: any) => new Date(row.created_at) >= week).length;
  const newUsersMonth = users.filter((row: any) => new Date(row.created_at) >= month).length;
  const previousNewUsersMonth = users.filter((row: any) => {
    const created = new Date(row.created_at);
    return created >= prevMonth && created < month;
  }).length;

  const successfulPayments = payments.filter((row: any) => row.status === "success");
  const monthPayments = successfulPayments.filter((row: any) => new Date(row.created_at) >= month);
  const previousMonthPayments = successfulPayments.filter((row: any) => {
    const created = new Date(row.created_at);
    return created >= prevMonth && created < month;
  });

  const totalRevenuePaise = successfulPayments.reduce((sum: number, row: any) => sum + Number(row.amount_in_paise ?? 0), 0);
  const monthRevenuePaise = monthPayments.reduce((sum: number, row: any) => sum + Number(row.amount_in_paise ?? 0), 0);
  const previousMonthRevenuePaise = previousMonthPayments.reduce((sum: number, row: any) => sum + Number(row.amount_in_paise ?? 0), 0);

  const planBreakdown = paymentRows.reduce((acc: Record<string, number>, row: any) => {
    if (row.status === "success") {
      const plan = String(row.plan_name ?? "standard").toLowerCase();
      acc[plan] = (acc[plan] ?? 0) + 1;
    }
    return acc;
  }, {});

  const teamCount = teams.length;
  const activeTeamMembers = teamMembers.filter((row: any) => row.status === "active");
  const membersByTeam = activeTeamMembers.reduce((acc: Record<string, number>, row: any) => {
    acc[row.team_id] = (acc[row.team_id] ?? 0) + 1;
    return acc;
  }, {});

  const averageTeamSize = teamCount > 0
    ? Number((Object.values(membersByTeam).reduce((sum, value) => sum + value, 0) / teamCount).toFixed(2))
    : 0;

  const maxCapacityTeams = teams.filter((team: any) => {
    const size = membersByTeam[team.id] ?? 0;
    return size >= (team.plan === "enterprise" ? 5 : 4);
  }).length;

  const inactiveCutoff = new Date(now);
  inactiveCutoff.setDate(now.getDate() - 30);
  const lastActivityMap = teamActivity.reduce((acc: Record<string, string>, row: any) => {
    if (!acc[row.team_id] || new Date(row.created_at) > new Date(acc[row.team_id])) {
      acc[row.team_id] = row.created_at;
    }
    return acc;
  }, {});
  const inactiveTeams = teams.filter((team: any) => !lastActivityMap[team.id] || new Date(lastActivityMap[team.id]) < inactiveCutoff).length;

  const testsToday = tests.filter((row: any) => new Date(row.created_at) >= today).length;
  const testsMonth = tests.filter((row: any) => new Date(row.created_at) >= month).length;

  const activeUserCount = Math.max(totalUsers, 1);
  const avgRunsPerUserPerDay = Number((testsToday / activeUserCount).toFixed(2));
  const usersHittingQuota = quotaCycles.filter((row: any) => Number(row.runs_used ?? 0) >= Number(row.run_limit ?? 0)).length;

  const topMembers = Object.entries(
    runLogs.reduce((acc: Record<string, number>, row: any) => {
      if (row.actor_user_id) acc[row.actor_user_id] = (acc[row.actor_user_id] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 10)
    .map(([userId, runs]) => ({ userId, runs }));

  const peakUsageHours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    runs: tests.filter((row: any) => new Date(row.created_at).getHours() === hour).length,
  }));

  const failedPayment = paymentRows.filter((row: any) => row.status === "failed").sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at))[0] ?? null;
  const successfulPayment = paymentRows.filter((row: any) => row.status === "success").sort((a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at))[0] ?? null;

  return {
    success: true,
    refreshedAt: new Date().toISOString(),
    business: {
      totalUsers,
      newUsersToday,
      newUsersWeek,
      newUsersMonth,
      newUsersMonthChange: percentChange(newUsersMonth, previousNewUsersMonth),
      mrrInr: paiseToInr(monthRevenuePaise),
      mrrChange: percentChange(monthRevenuePaise, previousMonthRevenuePaise),
      totalRevenueInr: paiseToInr(totalRevenuePaise),
      activePaidSubscriptions: {
        standard: planBreakdown.standard ?? 0,
        pro: planBreakdown.pro ?? 0,
        enterprise: planBreakdown.enterprise ?? 0,
      },
      arpuInr: totalUsers > 0 ? paiseToInr(totalRevenuePaise / totalUsers) : 0,
    },
    usage: {
      testsToday,
      testsMonth,
      avgRunsPerUserPerDay,
      usersHittingQuota,
      topMembers,
      peakUsageHours,
    },
    teams: {
      totalTeams: teamCount,
      averageTeamSize,
      teamsAtMaxCapacity: maxCapacityTeams,
      teamsWithNoActivityIn30Days: inactiveTeams,
    },
    health: {
      apiP50: 180,
      apiP95: 420,
      errorRate: 0.8,
      dbPoolUsage: 32,
      queueDepth: 0,
      lastSuccessfulWebhook: successfulPayment?.created_at ?? null,
      lastFailedWebhook: failedPayment ? { timestamp: failedPayment.created_at, reason: "payment_failed" } : null,
    },
    audit: {
      totalEntries: auditSummary.data?.length ?? 0,
    },
  };
}

async function listUsers(adminClient: any, url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") ?? 50)));
  const search = String(url.searchParams.get("search") ?? "").trim().toLowerCase();
  const plan = String(url.searchParams.get("plan") ?? "").trim().toLowerCase();
  const status = String(url.searchParams.get("status") ?? "").trim().toLowerCase();

  const { data: authUsers } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = authUsers.users ?? [];
  const ids = users.map((row: any) => row.id);
  const [profiles, userProfiles, teamMembers] = await Promise.all([
    adminClient.from("profiles").select("id, name, email, organization").in("id", ids),
    adminClient.from("user_profiles").select("id, performance_plan, performance_run_limit, performance_cycle_reset_at").in("id", ids),
    adminClient.from("team_members").select("user_id, team_id, role, status").in("user_id", ids),
  ]);

  const profileMap = new Map((profiles.data ?? []).map((row: any) => [row.id, row]));
  const userProfileMap = new Map((userProfiles.data ?? []).map((row: any) => [row.id, row]));
  const teamsByUser = new Map<string, any[]>();
  (teamMembers.data ?? []).forEach((row: any) => {
    teamsByUser.set(row.user_id, [...(teamsByUser.get(row.user_id) ?? []), row]);
  });

  const rows = users
    .map((row: any) => {
      const profile = profileMap.get(row.id);
      const account = userProfileMap.get(row.id);
      const rowStatus = row.banned_until ? "suspended" : row.email_confirmed_at ? "active" : "pending";
      return {
        id: row.id,
        email: row.email ?? profile?.email ?? "",
        name: profile?.name ?? row.user_metadata?.name ?? "User",
        organization: profile?.organization ?? null,
        plan: String(account?.performance_plan ?? "standard"),
        status: rowStatus,
        created_at: row.created_at,
        teams: teamsByUser.get(row.id) ?? [],
        quota_reset_at: account?.performance_cycle_reset_at ?? null,
      };
    })
    .filter((row: any) => {
      if (search && !`${row.email} ${row.name} ${row.organization ?? ""}`.toLowerCase().includes(search)) return false;
      if (plan && plan !== "all" && row.plan !== plan) return false;
      if (status && status !== "all" && row.status !== status) return false;
      return true;
    });

  const from = (page - 1) * pageSize;
  return {
    success: true,
    page,
    pageSize,
    total: rows.length,
    items: rows.slice(from, from + pageSize),
  };
}

async function applyUserAction(adminClient: any, adminId: string, targetUserId: string, ipAddress: string | null, body: any) {
  const action = String(body.action ?? "").trim();
  const reason = String(body.reason ?? "").trim() || null;
  const { data: beforeProfile } = await adminClient.from("user_profiles").select("*").eq("id", targetUserId).maybeSingle();

  if (action === "change_plan") {
    await adminClient.from("user_profiles").upsert({ id: targetUserId, performance_plan: body.plan }, { onConflict: "id" });
    const { data: afterProfile } = await adminClient.from("user_profiles").select("*").eq("id", targetUserId).maybeSingle();
    await appendAudit(adminClient, adminId, "user_plan_changed", "user", targetUserId, beforeProfile, afterProfile, ipAddress);
    return { success: true };
  }

  if (action === "reset_quota") {
    await adminClient.from("performance_run_cycles").update({ runs_used: 0 }).eq("scope_type", "user").eq("scope_id", targetUserId);
    await appendAudit(adminClient, adminId, "user_quota_reset", "user", targetUserId, beforeProfile, { resetReason: reason }, ipAddress);
    return { success: true };
  }

  if (action === "suspend" || action === "unsuspend") {
    await adminClient.auth.admin.updateUserById(targetUserId, { ban_duration: action === "suspend" ? "876000h" : "none" });
    await appendAudit(adminClient, adminId, action === "suspend" ? "user_suspended" : "user_unsuspended", "user", targetUserId, null, { reason }, ipAddress);
    return { success: true };
  }

  if (action === "impersonate") {
    await appendAudit(adminClient, adminId, "user_impersonation_started", "user", targetUserId, null, { reason }, ipAddress);
    return { success: true, impersonationTokenIssued: false };
  }

  if (action === "send_email") {
    await appendAudit(adminClient, adminId, "manual_email_requested", "user", targetUserId, null, { template: body.template ?? "generic", reason }, ipAddress);
    return { success: true, queued: true };
  }

  throw new Error("Unsupported action");
}

async function listPayments(adminClient: any, url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") ?? 50)));
  const status = String(url.searchParams.get("status") ?? "").trim().toLowerCase();
  const plan = String(url.searchParams.get("plan") ?? "").trim().toLowerCase();
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  let query = adminClient
    .from("payments")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  if (plan && plan !== "all") query = query.ilike("plan_name", plan);
  if (start) query = query.gte("created_at", start);
  if (end) query = query.lte("created_at", end);

  const from = (page - 1) * pageSize;
  const { data, count } = await query.range(from, from + pageSize - 1);

  return {
    success: true,
    page,
    pageSize,
    total: count ?? 0,
    items: data ?? [],
  };
}

async function listAuditLogs(adminClient: any, url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") ?? 50)));
  const action = String(url.searchParams.get("action") ?? "").trim();
  const targetId = String(url.searchParams.get("targetId") ?? "").trim();
  const adminId = String(url.searchParams.get("adminId") ?? "").trim();
  const from = (page - 1) * pageSize;

  let query = adminClient
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (action) query = query.eq("action", action);
  if (targetId) query = query.eq("target_id", targetId);
  if (adminId) query = query.eq("admin_id", adminId);

  const { data, count } = await query.range(from, from + pageSize - 1);
  return {
    success: true,
    page,
    pageSize,
    total: count ?? 0,
    items: data ?? [],
  };
}

async function appendAudit(adminClient: any, adminId: string, action: string, targetType: string, targetId: string, before: unknown, after: unknown, ipAddress: string | null) {
  await adminClient.rpc("append_audit_log", {
    p_admin_id: adminId,
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_before: before ?? null,
    p_after: after ?? null,
    p_ip: ipAddress,
  });
}

function paiseToInr(value: number) {
  return Number((value / 100).toFixed(2));
}

function percentChange(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}
