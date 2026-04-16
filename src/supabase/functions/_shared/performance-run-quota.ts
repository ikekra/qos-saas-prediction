import type { User } from "https://esm.sh/@supabase/supabase-js@2";

export type PerformancePlan = "standard" | "pro" | "enterprise";

type AdminClient = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type ProfileRow = {
  token_balance?: number | null;
  lifetime_tokens_used?: number | null;
  email?: string | null;
  performance_plan?: string | null;
  performance_run_limit?: number | null;
  performance_cycle_reset_at?: string | null;
  performance_org_id?: string | null;
  account_manager_webhook?: string | null;
};

type ReservedRunRow = {
  success: boolean;
  blocked: boolean;
  plan: PerformancePlan;
  scope_type: "user" | "org" | "team";
  scope_id: string;
  run_limit: number;
  runs_used: number;
  runs_remaining: number;
  run_number: number;
  reset_date: string;
  soft_limit_alerted_at?: string | null;
  hard_limit_alerted_at?: string | null;
  soft_alert_needed?: boolean;
  hard_alert_needed?: boolean;
};

export type PerformanceQuotaState = {
  userId: string;
  orgId: string | null;
  teamId: string | null;
  plan: PerformancePlan;
  scopeType: "user" | "org" | "team";
  scopeId: string;
  runLimit: number;
  runsUsed: number;
  runsRemaining: number;
  runNumber: number;
  resetDate: string;
  accountManagerWebhook: string | null;
  warning: string | null;
  exhaustedMessage: string | null;
  ctaLabel: string | null;
  softAlertNeeded: boolean;
  hardAlertNeeded: boolean;
  teamRole: "owner" | "admin" | "member" | null;
};

const PLAN_LIMITS: Record<PerformancePlan, number> = {
  standard: Number(Deno.env.get("STANDARD_RUN_LIMIT") ?? 10),
  pro: Number(Deno.env.get("PRO_RUN_LIMIT") ?? 50),
  enterprise: Number(Deno.env.get("ENTERPRISE_DEFAULT_RUN_LIMIT") ?? 500),
};

const normalizePlan = (value: string | null | undefined): PerformancePlan => {
  const plan = String(value ?? "").trim().toLowerCase();
  if (plan === "pro" || plan === "enterprise") return plan;
  return "standard";
};

const normalizeLimit = (plan: PerformancePlan, value: number | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : PLAN_LIMITS[plan];
};

const buildNextResetDate = (source?: string | null) => {
  if (source) {
    const existing = new Date(source);
    if (!Number.isNaN(existing.getTime()) && existing >= new Date()) {
      return existing.toISOString().slice(0, 10);
    }
  }

  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
};

const buildQuotaWarning = (plan: PerformancePlan, runsRemaining: number, runLimit: number, runsUsed: number) => {
  if (plan === "pro" && runsRemaining > 0 && runsRemaining <= 10) {
    return `Heads up - you have ${runsRemaining} performance test runs left this cycle.`;
  }

  if (plan === "enterprise" && runsRemaining > 0 && runsUsed >= Math.ceil(runLimit * 0.9)) {
    return "You have used 90% of your Enterprise run quota. Your account manager has been notified.";
  }

  return null;
};

const buildExhaustedMessage = (plan: PerformancePlan, runLimit: number, resetDate: string) => {
  if (plan === "standard") {
    return `You have used all ${runLimit} performance test runs on your Standard plan. Your quota resets on ${resetDate}. Upgrade to Pro for 50 runs/month.`;
  }

  if (plan === "pro") {
    return `You have used all ${runLimit} performance test runs on your Pro plan. Your quota resets on ${resetDate}. Contact us for an Enterprise plan with unlimited custom run quotas.`;
  }

  return `Your organisation has reached the ${runLimit} run limit for this cycle. Contact your account manager to expand your quota or wait for reset on ${resetDate}.`;
};

const buildCtaLabel = (plan: PerformancePlan) => {
  if (plan === "standard") return "Upgrade to Pro";
  if (plan === "pro") return "Contact Sales -> Enterprise";
  return "Contact Sales -> Enterprise";
};

const resolveWebhookUrl = (base: string, path: string) => {
  const trimmed = base.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (trimmed.endsWith(path)) return trimmed;
  return `${trimmed}${path}`;
};

const summarizeResult = (params: {
  status: "completed" | "failed";
  latency: number | null;
  uptime: number | null;
  throughput: number | null;
  successRate: number | null;
  errorMessage: string | null;
}) => {
  if (params.status === "failed") {
    return params.errorMessage ? `failed: ${params.errorMessage}` : "failed";
  }

  const parts = [
    typeof params.latency === "number" ? `latency ${Math.round(params.latency)}ms` : null,
    typeof params.uptime === "number" ? `uptime ${Math.round(params.uptime)}%` : null,
    typeof params.throughput === "number" ? `throughput ${Math.round(params.throughput)}` : null,
    typeof params.successRate === "number" ? `success ${Math.round(params.successRate)}%` : null,
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : "completed";
};

async function ensureUserProfile(adminClient: AdminClient, user: User): Promise<ProfileRow> {
  const profileSelect = await adminClient
    .from("user_profiles")
    .select("token_balance, lifetime_tokens_used, email, performance_plan, performance_run_limit, performance_cycle_reset_at, performance_org_id, account_manager_webhook")
    .eq("id", user.id)
    .limit(1);

  if (profileSelect.error) {
    throw new Error(`Failed to load user profile: ${profileSelect.error.message}`);
  }

  const existing = profileSelect.data?.[0] as ProfileRow | undefined;
  if (existing) return existing;

  const defaultReset = buildNextResetDate(null);
  const profileCreate = await adminClient
    .from("user_profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? `${user.id}@local.user`,
        token_balance: 0,
        lifetime_tokens_used: 0,
        performance_plan: "standard",
        performance_cycle_reset_at: defaultReset,
      },
      { onConflict: "id" },
    )
    .select("token_balance, lifetime_tokens_used, email, performance_plan, performance_run_limit, performance_cycle_reset_at, performance_org_id, account_manager_webhook")
    .limit(1);

  if (profileCreate.error) {
    throw new Error(`Failed to initialize profile: ${profileCreate.error.message}`);
  }

  return (profileCreate.data?.[0] as ProfileRow | undefined) ?? {
    token_balance: 0,
    lifetime_tokens_used: 0,
    email: user.email ?? `${user.id}@local.user`,
    performance_plan: "standard",
    performance_cycle_reset_at: defaultReset,
  };
}

function resolveQuotaConfig(user: User, profile: ProfileRow) {
  const plan = normalizePlan(profile.performance_plan);
  const runLimit = normalizeLimit(plan, profile.performance_run_limit);
  const resetDate = buildNextResetDate(profile.performance_cycle_reset_at);
  const orgId =
    plan === "enterprise"
      ? String(profile.performance_org_id || "").trim() || user.id
      : null;
  const scopeType = plan === "enterprise" ? "org" : "user";
  const scopeId = plan === "enterprise" ? (orgId as string) : user.id;

  return {
    plan,
    runLimit,
    resetDate,
    orgId,
    scopeType,
    scopeId,
    accountManagerWebhook: profile.account_manager_webhook?.trim() || null,
  } as const;
}

export async function getPerformanceQuotaState(adminClient: AdminClient, user: User): Promise<PerformanceQuotaState> {
  const profile = await ensureUserProfile(adminClient, user);
  const teamMembership = await adminClient
    .from("team_members")
    .select("team_id, role, status, teams!inner(id, plan, max_members, deleted_at)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .is("teams.deleted_at", null)
    .maybeSingle();

  if (!teamMembership.error && teamMembership.data?.team_id) {
    const teamPlan = normalizePlan((teamMembership.data.teams as { plan?: string | null })?.plan);
    const runLimit = teamPlan === "enterprise" ? 950 : 500;
    const quotaCycle = await adminClient.rpc("ensure_team_quota_cycle", {
      p_team_id: teamMembership.data.team_id,
      p_run_limit: runLimit,
    });

    if (quotaCycle.error) {
      throw new Error(`Failed to load team quota: ${quotaCycle.error.message}`);
    }

    const quotaRow = Array.isArray(quotaCycle.data)
      ? (quotaCycle.data[0] as Record<string, unknown> | undefined)
      : (quotaCycle.data as Record<string, unknown> | undefined);

    const runsUsed = Number(quotaRow?.runs_used ?? 0);
    const runsRemaining = Math.max(0, runLimit - runsUsed);
    const resetDate = String(quotaRow?.reset_at ?? buildNextResetDate(null));

    return {
      userId: user.id,
      orgId: null,
      teamId: String(teamMembership.data.team_id),
      plan: teamPlan,
      scopeType: "team",
      scopeId: String(teamMembership.data.team_id),
      runLimit,
      runsUsed,
      runsRemaining,
      runNumber: runsUsed,
      resetDate,
      accountManagerWebhook: null,
      warning: runsRemaining > 0 && runsRemaining <= 25 ? `Your team has ${runsRemaining} shared test runs left this cycle.` : null,
      exhaustedMessage:
        runsRemaining === 0
          ? `Your team has used all ${runLimit} shared performance test runs. The quota resets on ${new Date(resetDate).toLocaleDateString("en-IN")}.`
          : null,
      ctaLabel: teamPlan === "pro" ? "Upgrade to Enterprise" : null,
      softAlertNeeded: false,
      hardAlertNeeded: false,
      teamRole: (teamMembership.data.role as "owner" | "admin" | "member") ?? null,
    };
  }

  const config = resolveQuotaConfig(user, profile);
  const today = new Date().toISOString().slice(0, 10);

  const cycleSelect = await adminClient
    .from("performance_run_cycles")
    .select("*")
    .eq("scope_type", config.scopeType)
    .eq("scope_id", config.scopeId)
    .maybeSingle();

  if (cycleSelect.error) {
    throw new Error(`Failed to load performance quota: ${cycleSelect.error.message}`);
  }

  const shouldReset = cycleSelect.data?.reset_date && String(cycleSelect.data.reset_date) < today;
  const shouldCreate = !cycleSelect.data;
  const shouldSync =
    shouldCreate ||
    shouldReset ||
    cycleSelect.data?.plan !== config.plan ||
    Number(cycleSelect.data?.run_limit ?? 0) !== config.runLimit ||
    String(cycleSelect.data?.reset_date ?? "") !== config.resetDate ||
    (cycleSelect.data?.account_manager_webhook ?? null) !== config.accountManagerWebhook;

  let cycle = cycleSelect.data as Record<string, unknown> | null;

  if (shouldSync) {
    const payload = {
      scope_type: config.scopeType,
      scope_id: config.scopeId,
      plan: config.plan,
      run_limit: config.runLimit,
      runs_used: shouldReset ? 0 : Number(cycleSelect.data?.runs_used ?? 0),
      reset_date: config.resetDate,
      account_manager_webhook: config.accountManagerWebhook,
      soft_limit_alerted_at: shouldReset ? null : cycleSelect.data?.soft_limit_alerted_at ?? null,
      hard_limit_alerted_at: shouldReset ? null : cycleSelect.data?.hard_limit_alerted_at ?? null,
    };

    const upsert = await adminClient
      .from("performance_run_cycles")
      .upsert(payload, { onConflict: "scope_type,scope_id" })
      .select("*")
      .single();

    if (upsert.error) {
      throw new Error(`Failed to sync performance quota: ${upsert.error.message}`);
    }

    cycle = upsert.data as Record<string, unknown>;
  }

  const runsUsed = Number(cycle?.runs_used ?? 0);
  const runsRemaining = Math.max(0, config.runLimit - runsUsed);

  return {
    userId: user.id,
    orgId: config.orgId,
    teamId: null,
    plan: config.plan,
    scopeType: config.scopeType,
    scopeId: config.scopeId,
    runLimit: config.runLimit,
    runsUsed,
    runsRemaining,
    runNumber: runsUsed,
    resetDate: config.resetDate,
    accountManagerWebhook: config.accountManagerWebhook,
    warning: buildQuotaWarning(config.plan, runsRemaining, config.runLimit, runsUsed),
    exhaustedMessage: runsRemaining === 0 ? buildExhaustedMessage(config.plan, config.runLimit, config.resetDate) : null,
    ctaLabel: runsRemaining === 0 ? buildCtaLabel(config.plan) : null,
    softAlertNeeded:
      config.plan === "enterprise" &&
      runsUsed >= Math.ceil(config.runLimit * 0.9) &&
      !cycle?.soft_limit_alerted_at,
    hardAlertNeeded:
      config.plan === "enterprise" &&
      runsUsed >= config.runLimit &&
      !cycle?.hard_limit_alerted_at,
    teamRole: null,
  };
}

async function sendQuotaAlert(baseUrl: string, path: string, payload: Record<string, unknown>) {
  const endpoint = resolveWebhookUrl(baseUrl, path);
  if (!endpoint) return false;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error) {
    console.error(`Quota alert failed for ${endpoint}:`, error);
    return false;
  }
}

export async function reservePerformanceRun(adminClient: AdminClient, user: User): Promise<PerformanceQuotaState> {
  const profile = await ensureUserProfile(adminClient, user);
  const teamMembership = await adminClient
    .from("team_members")
    .select("team_id, role, teams!inner(id, plan, deleted_at)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .is("teams.deleted_at", null)
    .maybeSingle();

  if (!teamMembership.error && teamMembership.data?.team_id) {
    const teamPlan = normalizePlan((teamMembership.data.teams as { plan?: string | null })?.plan);
    const reservation = await adminClient.rpc("reserve_team_quota_run", {
      p_team_id: teamMembership.data.team_id,
      p_run_limit: teamPlan === "enterprise" ? 950 : 500,
    });

    if (reservation.error) {
      throw new Error(`Failed to reserve team quota run: ${reservation.error.message}`);
    }

    const row = Array.isArray(reservation.data)
      ? (reservation.data[0] as Record<string, unknown> | undefined)
      : (reservation.data as Record<string, unknown> | undefined);

    if (!row) {
      throw new Error("Team quota reservation returned no data");
    }

    const runLimit = Number(row.run_limit ?? (teamPlan === "enterprise" ? 950 : 500));
    const runsUsed = Number(row.runs_used ?? 0);
    const runsRemaining = Math.max(0, Number(row.runs_remaining ?? 0));
    const resetDate = String(row.reset_at ?? buildNextResetDate(null));

    return {
      userId: user.id,
      orgId: null,
      teamId: String(teamMembership.data.team_id),
      plan: teamPlan,
      scopeType: "team",
      scopeId: String(teamMembership.data.team_id),
      runLimit,
      runsUsed,
      runsRemaining,
      runNumber: runsUsed,
      resetDate,
      accountManagerWebhook: null,
      warning: runsRemaining > 0 && runsRemaining <= 25 ? `Your team has ${runsRemaining} shared test runs left this cycle.` : null,
      exhaustedMessage:
        row.success === false
          ? `Your team has used all ${runLimit} shared performance test runs. The quota resets on ${new Date(resetDate).toLocaleDateString("en-IN")}.`
          : null,
      ctaLabel: teamPlan === "pro" && row.success === false ? "Upgrade to Enterprise" : null,
      softAlertNeeded: false,
      hardAlertNeeded: false,
      teamRole: (teamMembership.data.role as "owner" | "admin" | "member") ?? null,
    };
  }

  const config = resolveQuotaConfig(user, profile);

  const reservation = await adminClient.rpc("reserve_performance_test_run", {
    p_scope_type: config.scopeType,
    p_scope_id: config.scopeId,
    p_plan: config.plan,
    p_run_limit: config.runLimit,
    p_reset_date: config.resetDate,
    p_account_manager_webhook: config.accountManagerWebhook,
  });

  if (reservation.error) {
    throw new Error(`Failed to reserve performance test run: ${reservation.error.message}`);
  }

  const row = Array.isArray(reservation.data)
    ? (reservation.data[0] as ReservedRunRow | undefined)
    : (reservation.data as ReservedRunRow | undefined);

  if (!row) {
    throw new Error("Performance quota reservation returned no data");
  }

  const state: PerformanceQuotaState = {
    userId: user.id,
    orgId: config.orgId,
    teamId: null,
    plan: row.plan,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    runLimit: Number(row.run_limit ?? config.runLimit),
    runsUsed: Number(row.runs_used ?? 0),
    runsRemaining: Math.max(0, Number(row.runs_remaining ?? 0)),
    runNumber: Number(row.run_number ?? 0),
    resetDate: String(row.reset_date ?? config.resetDate),
    accountManagerWebhook: config.accountManagerWebhook,
    warning: buildQuotaWarning(row.plan, Number(row.runs_remaining ?? 0), Number(row.run_limit ?? config.runLimit), Number(row.runs_used ?? 0)),
    exhaustedMessage: row.blocked
      ? buildExhaustedMessage(row.plan, Number(row.run_limit ?? config.runLimit), String(row.reset_date ?? config.resetDate))
      : null,
    ctaLabel: row.blocked ? buildCtaLabel(row.plan) : null,
    softAlertNeeded: Boolean(row.soft_alert_needed),
    hardAlertNeeded: Boolean(row.hard_alert_needed),
    teamRole: null,
  };

  const alertPayload = {
    org_id: config.orgId,
    user_id: user.id,
    plan: row.plan,
    run_limit: state.runLimit,
    runs_used: state.runsUsed,
    runs_remaining: state.runsRemaining,
    reset_date: state.resetDate,
  };

  if (state.plan === "enterprise" && state.softAlertNeeded && state.accountManagerWebhook) {
    const sent = await sendQuotaAlert(state.accountManagerWebhook, "/alerts/quota-soft-limit", alertPayload);
    if (sent) {
      await adminClient.rpc("acknowledge_performance_quota_alert", {
        p_scope_type: state.scopeType,
        p_scope_id: state.scopeId,
        p_alert_type: "soft",
      });
    }
  }

  if (state.plan === "enterprise" && state.hardAlertNeeded && state.accountManagerWebhook) {
    const sent = await sendQuotaAlert(state.accountManagerWebhook, "/alerts/quota-hard-limit", alertPayload);
    if (sent) {
      await adminClient.rpc("acknowledge_performance_quota_alert", {
        p_scope_type: state.scopeType,
        p_scope_id: state.scopeId,
        p_alert_type: "hard",
      });
    }
  }

  return state;
}

export async function logPerformanceRun(
  adminClient: AdminClient,
  quota: PerformanceQuotaState,
  params: {
    testType: string;
    durationMs: number;
    status: "completed" | "failed";
    latency: number | null;
    uptime: number | null;
    throughput: number | null;
    successRate: number | null;
    errorMessage: string | null;
  },
) {
  const resultSummary = summarizeResult({
    status: params.status,
    latency: params.latency,
    uptime: params.uptime,
    throughput: params.throughput,
    successRate: params.successRate,
    errorMessage: params.errorMessage,
  });

  const insert = await adminClient.from("performance_test_run_logs").insert({
    org_id: quota.orgId,
    team_id: quota.teamId,
    user_id: quota.userId,
    actor_user_id: quota.userId,
    plan: quota.plan,
    run_number: quota.runNumber,
    test_type: params.testType,
    duration_ms: Math.max(0, Math.round(params.durationMs)),
    result_summary: resultSummary,
    quota_scope_type: quota.scopeType,
    quota_scope_id: quota.scopeId,
  });

  if (insert.error) {
    console.error("Performance run audit logging failed", insert.error);
  }
}
