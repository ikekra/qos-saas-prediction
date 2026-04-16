import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type User } from "npm:@supabase/supabase-js@2";
import { sendTeamInvitationEmail } from "../_shared/team-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

type TeamPlan = "pro" | "enterprise";
type TeamRole = "owner" | "admin" | "member";
type TeamMemberStatus = "active" | "invited" | "suspended" | "removed";
type InviteStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";

type RequestContext = {
  req: Request;
  authClient: ReturnType<typeof createClient>;
  adminClient: ReturnType<typeof createClient>;
  user: User | null;
};

type MemberRow = {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  status: TeamMemberStatus;
  joined_at: string | null;
  invited_by: string | null;
  created_at: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (
  error: string,
  errorCode: string,
  status: number,
  extra: Record<string, unknown> = {},
) => json({ success: false, error, errorCode, ...extra }, status);

const maxMembersForPlan = (plan: TeamPlan) => (plan === "enterprise" ? 5 : 4);
const teamRunLimit = (plan: TeamPlan) => (plan === "enterprise" ? 950 : 500);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const context = await getContext(req);
    const url = new URL(req.url);
    const route = url.pathname.includes("/api/")
      ? url.pathname.slice(url.pathname.indexOf("/api/"))
      : "/api";

    if (route === "/api/teams" && req.method === "POST") {
      return await createTeam(context);
    }

    if (route === "/api/teams/me" && req.method === "GET") {
      return await getMyTeam(context);
    }

    if (route.match(/^\/api\/teams\/[^/]+$/) && req.method === "GET") {
      return await getTeamDetails(context, getParam(route, 3));
    }

    if (route.match(/^\/api\/teams\/[^/]+$/) && req.method === "PATCH") {
      return await updateTeam(context, getParam(route, 3));
    }

    if (route.match(/^\/api\/teams\/[^/]+$/) && req.method === "DELETE") {
      return await deleteTeam(context, getParam(route, 3));
    }

    if (route.match(/^\/api\/teams\/[^/]+\/invite$/) && req.method === "POST") {
      return await inviteMember(context, getParam(route, 3));
    }

    if (route.match(/^\/api\/teams\/[^/]+\/members$/) && req.method === "GET") {
      return await listMembers(context, getParam(route, 3));
    }

    if (route.match(/^\/api\/teams\/[^/]+\/members\/[^/]+$/) && req.method === "DELETE") {
      return await removeMember(context, getParam(route, 3), getParam(route, 5));
    }

    if (route.match(/^\/api\/teams\/[^/]+\/members\/[^/]+$/) && req.method === "PATCH") {
      return await changeMemberRole(context, getParam(route, 3), getParam(route, 5));
    }

    if (route.match(/^\/api\/teams\/[^/]+\/transfer-ownership$/) && req.method === "POST") {
      return await transferOwnership(context, getParam(route, 3));
    }

    if (route.match(/^\/api\/teams\/[^/]+\/invitations\/[^/]+$/) && req.method === "DELETE") {
      return await revokeInvite(context, getParam(route, 3), getParam(route, 5));
    }

    if (route.match(/^\/api\/teams\/[^/]+\/activity$/) && req.method === "GET") {
      return await getActivity(context, getParam(route, 3), url);
    }

    if (route.match(/^\/api\/invitations\/[^/]+$/) && req.method === "GET") {
      return await validateInvitation(context, getParam(route, 3));
    }

    if (route.match(/^\/api\/invitations\/[^/]+\/accept$/) && req.method === "POST") {
      return await acceptInvitation(context, getParam(route, 3));
    }

    if (route.match(/^\/api\/invitations\/[^/]+\/decline$/) && req.method === "POST") {
      return await declineInvitation(context, getParam(route, 3));
    }

    return json({ error: "Route not found" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return json({ error: message }, 500);
  }
});

async function getContext(req: Request): Promise<RequestContext> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const authClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization") ?? "",
      },
    },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
  } = await authClient.auth.getUser();

  return { req, authClient, adminClient, user };
}

function getParam(route: string, index: number) {
  return route.split("/")[index] ?? "";
}

async function requireUser(context: RequestContext) {
  if (!context.user) {
    return { ok: false as const, response: json({ error: "Unauthorized" }, 401) };
  }
  return { ok: true as const, user: context.user };
}

async function createTeam(context: RequestContext) {
  const auth = await requireUser(context);
  if (!auth.ok) return auth.response;

  const body = await context.req.json().catch(() => ({})) as {
    name?: string;
    slug?: string;
    avatarUrl?: string | null;
  };

  const name = String(body.name ?? "").trim();
  const slug = slugify(String(body.slug ?? name));
  const avatarUrl = body.avatarUrl ? String(body.avatarUrl) : null;
  if (!name || !slug) {
    return fail("name and slug are required", "TEAM_CREATE_VALIDATION", 400);
  }
  if (name.length < 2 || name.length > 100) {
    return fail("Team name must be between 2 and 100 characters.", "TEAM_NAME_INVALID", 400, {
      fieldErrors: { name: "Team name must be between 2 and 100 characters." },
    });
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return fail("Slug must use lowercase letters, numbers, and hyphens only.", "TEAM_SLUG_INVALID", 400, {
      fieldErrors: { slug: "Slug must use lowercase letters, numbers, and hyphens only." },
    });
  }

  const { data: existingMembership } = await context.adminClient
    .from("team_members")
    .select("team_id, role, status")
    .eq("user_id", auth.user.id)
    .in("status", ["active", "invited"])
    .limit(1)
    .maybeSingle();

  if (existingMembership?.team_id) {
    return fail(
      "You are already part of a team. Leave your current team before creating a new one.",
      "TEAM_MEMBERSHIP_CONFLICT",
      409,
    );
  }

  const plan = await resolveEligibleTeamPlan(context.adminClient, auth.user);
  if (!plan) {
    return fail(
      "Your current plan does not support teams. Upgrade to Pro or Enterprise.",
      "TEAM_PLAN_NOT_ELIGIBLE",
      403,
    );
  }

  const { data: existingOwned } = await context.adminClient
    .from("teams")
    .select("id")
    .eq("owner_id", auth.user.id)
    .is("deleted_at", null)
    .limit(1);

  if ((existingOwned ?? []).length > 0) {
    return fail("You already own a team.", "TEAM_OWNER_CONFLICT", 409);
  }

  const maxMembers = maxMembersForPlan(plan);
  const { data: team, error: teamError } = await context.adminClient
    .from("teams")
    .insert({
      name,
      slug,
      owner_id: auth.user.id,
      plan,
      max_members: maxMembers,
      avatar_url: avatarUrl,
    })
    .select("*")
    .single();

  if (teamError) {
    if (String(teamError.code ?? "") === "23505") {
      return fail("That team slug is already taken. Try a different slug.", "TEAM_SLUG_CONFLICT", 409, {
        fieldErrors: { slug: "That team slug is already taken. Try a different slug." },
      });
    }
    return fail(teamError.message, "TEAM_CREATE_FAILED", 400);
  }

  const { error: memberError } = await context.adminClient.from("team_members").insert({
    team_id: team.id,
    user_id: auth.user.id,
    role: "owner",
    status: "active",
    invited_by: auth.user.id,
    joined_at: new Date().toISOString(),
  });

  if (memberError) {
    // Keep team creation atomic for users: if owner membership fails, rollback team.
    await context.adminClient.from("teams").delete().eq("id", team.id);
    return fail(memberError.message, "TEAM_OWNER_MEMBER_CREATE_FAILED", 400);
  }

  await ensureTeamQuota(context.adminClient, team.id, teamRunLimit(plan));
  await logTeamActivity(context.adminClient, team.id, auth.user.id, "team_created", "team", team.id, {
    plan,
    maxMembers,
  });

  return json({ success: true, process: "standard-v1", team });
}

async function getMyTeam(context: RequestContext) {
  const auth = await requireUser(context);
  if (!auth.ok) return auth.response;

  const membership = await context.adminClient
    .from("team_members")
    .select("team_id")
    .eq("user_id", auth.user.id)
    .in("status", ["active", "invited"])
    .limit(1)
    .maybeSingle();

  if (!membership.data?.team_id) {
    const eligiblePlan = (await resolveEligibleTeamPlan(context.adminClient, auth.user)) ?? "standard";
    return json({
      success: true,
      team: null,
      eligiblePlan,
    });
  }

  return await getTeamDetails(context, String(membership.data.team_id));
}

async function getTeamDetails(context: RequestContext, teamId: string) {
  const access = await requireTeamAccess(context, teamId, "member");
  if (access.response) return access.response;

  const [teamRes, members, invites, quota, memberBreakdown] = await Promise.all([
    context.adminClient.from("teams").select("*").eq("id", teamId).maybeSingle(),
    fetchMembers(context.adminClient, teamId),
    context.adminClient
      .from("team_invitations")
      .select("*")
      .eq("team_id", teamId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    context.adminClient
      .from("team_quota_overview")
      .select("*")
      .eq("team_id", teamId)
      .maybeSingle(),
    context.adminClient
      .from("team_member_usage_breakdown")
      .select("*")
      .eq("team_id", teamId),
  ]);

  return json({
    success: true,
    team: teamRes.data,
    members,
    pendingInvitations: invites.data ?? [],
    quota: quota.data,
    usageByMember: memberBreakdown.data ?? [],
    permissions: {
      role: access.member.role,
      isOwner: access.member.role === "owner",
      canInvite: access.member.role === "owner" || access.member.role === "admin",
      canViewActivity: true,
    },
  });
}

async function updateTeam(context: RequestContext, teamId: string) {
  const access = await requireTeamAccess(context, teamId, "admin");
  if (access.response) return access.response;

  const body = await context.req.json().catch(() => ({})) as {
    name?: string;
    avatarUrl?: string | null;
  };

  const update: Record<string, unknown> = {};
  if (body.name) update.name = String(body.name).trim();
  if ("avatarUrl" in body) update.avatar_url = body.avatarUrl ? String(body.avatarUrl) : null;

  const { data: before } = await context.adminClient.from("teams").select("*").eq("id", teamId).maybeSingle();
  const { data, error } = await context.adminClient
    .from("teams")
    .update(update)
    .eq("id", teamId)
    .select("*")
    .single();

  if (error) return json({ error: error.message }, 400);

  await logTeamActivity(context.adminClient, teamId, access.user.id, "team_updated", "team", teamId, {
    before,
    after: data,
  });

  return json({ success: true, team: data });
}

async function deleteTeam(context: RequestContext, teamId: string) {
  const access = await requireTeamAccess(context, teamId, "owner");
  if (access.response) return access.response;

  const body = await context.req.json().catch(() => ({})) as { confirmText?: string };
  const { data: team } = await context.adminClient.from("teams").select("slug").eq("id", teamId).maybeSingle();
  if (!team) return json({ error: "Team not found" }, 404);

  if (String(body.confirmText ?? "").trim() !== team.slug) {
    return json({ error: `Confirmation required. Send confirmText='${team.slug}' to dissolve the team.` }, 400);
  }

  await context.adminClient.from("teams").update({ deleted_at: new Date().toISOString() }).eq("id", teamId);
  await context.adminClient.from("team_members").update({ status: "removed" }).eq("team_id", teamId);
  await context.adminClient.from("team_invitations").update({ status: "revoked" }).eq("team_id", teamId).eq("status", "pending");

  await logTeamActivity(context.adminClient, teamId, access.user.id, "team_dissolved", "team", teamId, {
    confirmedWith: team.slug,
  });

  return json({ success: true });
}

async function listMembers(context: RequestContext, teamId: string) {
  const access = await requireTeamAccess(context, teamId, "member");
  if (access.response) return access.response;
  const members = await fetchMembers(context.adminClient, teamId);
  return json({ success: true, members });
}

async function inviteMember(context: RequestContext, teamId: string) {
  const access = await requireTeamAccess(context, teamId, "admin");
  if (access.response) return access.response;

  const body = await context.req.json().catch(() => ({})) as {
    email?: string;
    role?: TeamRole;
  };

  const invitedEmail = String(body.email ?? "").trim().toLowerCase();
  const role = normalizeRole(body.role);
  if (!invitedEmail) return json({ error: "email is required" }, 400);

  const { data: team } = await context.adminClient.from("teams").select("*").eq("id", teamId).maybeSingle();
  if (!team) return json({ error: "Team not found" }, 404);

  const seatCount = await getSeatCount(context.adminClient, teamId);
  if (seatCount >= team.max_members) {
    return json({ error: `Team is at capacity (${team.max_members} seats).` }, 409);
  }

  const duplicateInvite = await context.adminClient
    .from("team_invitations")
    .select("id")
    .eq("team_id", teamId)
    .eq("invited_email", invitedEmail)
    .eq("status", "pending")
    .maybeSingle();

  if (duplicateInvite.data) {
    return json({ error: "An active invitation already exists for this email." }, 409);
  }

  const { data: existingMember } = await context.adminClient
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .in("status", ["active", "invited"])
    .maybeSingle();

  if (existingMember?.data && invitedEmail === (await getUserEmail(context.adminClient, existingMember.data.id))) {
    return json({ error: "User is already part of this team." }, 409);
  }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const token = crypto.randomUUID().replaceAll("-", "");
  const invitedUser = await findUserByEmail(context.adminClient, invitedEmail);
  const invitedPlan = normalizePersonalPlan((invitedUser?.user_metadata?.performance_plan as string | undefined) ?? null);

  const { data: invitation, error } = await context.adminClient
    .from("team_invitations")
    .insert({
      team_id: teamId,
      invited_email: invitedEmail,
      invited_by: access.user.id,
      token,
      role,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error) return json({ error: error.message }, 400);

  const inviteUrl = `${getBaseAppUrl()}/team/invitations/${token}`;
  const inviterName = access.user.user_metadata?.name || access.user.email || "A teammate";
  await sendTeamInvitationEmail({
    teamName: team.name,
    inviterName: String(inviterName),
    invitedEmail,
    inviteUrl,
    role: role === "owner" ? "admin" : role,
    expiresAt,
  });

  await logTeamActivity(context.adminClient, teamId, access.user.id, "member_invited", "team_invitation", invitation.id, {
    invitedEmail,
    role,
    seatCount,
    seatLimit: team.max_members,
    inviteePlan: invitedPlan,
    ownerPaysForSeat: invitedPlan === "standard",
  });

  return json({ success: true, invitation });
}

async function removeMember(context: RequestContext, teamId: string, userId: string) {
  const access = await requireTeamAccess(context, teamId, "member");
  if (access.response) return access.response;

  const target = await getMember(context.adminClient, teamId, userId);
  if (!target) return json({ error: "Member not found" }, 404);

  const isSelf = access.user.id === userId;
  const canRemove = access.member.role === "owner" || access.member.role === "admin" || isSelf;
  if (!canRemove) return json({ error: "Forbidden" }, 403);
  if (target.role === "owner") return json({ error: "Transfer ownership before removing the owner." }, 400);
  if (access.member.role === "admin" && target.role === "admin" && !isSelf) {
    return json({ error: "Admins can only remove members, not other admins." }, 403);
  }

  await context.adminClient
    .from("team_members")
    .update({ status: "removed" })
    .eq("team_id", teamId)
    .eq("user_id", userId);

  await logTeamActivity(context.adminClient, teamId, access.user.id, isSelf ? "member_left" : "member_removed", "team_member", target.id, {
    removedUserId: userId,
    removedBy: access.user.id,
  });

  return json({ success: true });
}

async function changeMemberRole(context: RequestContext, teamId: string, userId: string) {
  const access = await requireTeamAccess(context, teamId, "admin");
  if (access.response) return access.response;

  const body = await context.req.json().catch(() => ({})) as { role?: TeamRole };
  const role = normalizeRole(body.role);
  if (role === "owner") return json({ error: "Use transfer ownership to promote a new owner." }, 400);

  const target = await getMember(context.adminClient, teamId, userId);
  if (!target) return json({ error: "Member not found" }, 404);
  if (target.role === "owner") return json({ error: "Cannot change owner role directly." }, 400);
  if (access.member.role === "admin") return json({ error: "Only the owner can change roles." }, 403);

  await context.adminClient
    .from("team_members")
    .update({ role })
    .eq("team_id", teamId)
    .eq("user_id", userId);

  await logTeamActivity(context.adminClient, teamId, access.user.id, "member_role_changed", "team_member", target.id, {
    userId,
    previousRole: target.role,
    nextRole: role,
  });

  return json({ success: true });
}

async function transferOwnership(context: RequestContext, teamId: string) {
  const access = await requireTeamAccess(context, teamId, "owner");
  if (access.response) return access.response;

  const body = await context.req.json().catch(() => ({})) as { nextOwnerUserId?: string };
  const nextOwnerUserId = String(body.nextOwnerUserId ?? "").trim();
  if (!nextOwnerUserId) return json({ error: "nextOwnerUserId is required" }, 400);

  const nextOwner = await getMember(context.adminClient, teamId, nextOwnerUserId);
  if (!nextOwner || nextOwner.status !== "active") {
    return json({ error: "Ownership can only be transferred to an active team member." }, 400);
  }

  await context.adminClient.from("team_members").update({ role: "owner" }).eq("team_id", teamId).eq("user_id", nextOwnerUserId);
  await context.adminClient.from("team_members").update({ role: "admin" }).eq("team_id", teamId).eq("user_id", access.user.id);
  await context.adminClient.from("teams").update({ owner_id: nextOwnerUserId }).eq("id", teamId);

  await logTeamActivity(context.adminClient, teamId, access.user.id, "ownership_transferred", "team_member", nextOwner.id, {
    previousOwnerId: access.user.id,
    nextOwnerUserId,
  });

  return json({ success: true });
}

async function revokeInvite(context: RequestContext, teamId: string, inviteId: string) {
  const access = await requireTeamAccess(context, teamId, "admin");
  if (access.response) return access.response;

  const { data: invite } = await context.adminClient
    .from("team_invitations")
    .select("*")
    .eq("id", inviteId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (!invite) return json({ error: "Invitation not found" }, 404);

  await context.adminClient
    .from("team_invitations")
    .update({ status: "revoked" })
    .eq("id", inviteId);

  await logTeamActivity(context.adminClient, teamId, access.user.id, "invite_revoked", "team_invitation", inviteId, {
    invitedEmail: invite.invited_email,
  });

  return json({ success: true });
}

async function validateInvitation(context: RequestContext, token: string) {
  const invitation = await getInvitationByToken(context.adminClient, token);
  if (!invitation) return json({ error: "Invitation not found" }, 404);

  const expired = new Date(invitation.expires_at).getTime() < Date.now();
  const status = expired && invitation.status === "pending" ? "expired" : invitation.status;
  if (expired && invitation.status === "pending") {
    await context.adminClient.from("team_invitations").update({ status: "expired" }).eq("id", invitation.id);
  }

  const { data: team } = await context.adminClient.from("teams").select("id, name, slug, plan").eq("id", invitation.team_id).maybeSingle();

  return json({
    success: true,
    invitation: {
      ...invitation,
      status,
    },
    team,
  });
}

async function acceptInvitation(context: RequestContext, token: string) {
  const auth = await requireUser(context);
  if (!auth.ok) return auth.response;

  const invitation = await getInvitationByToken(context.adminClient, token);
  if (!invitation) return json({ error: "Invitation not found" }, 404);
  if (invitation.status !== "pending") return json({ error: "Invitation is no longer active." }, 400);
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    await context.adminClient.from("team_invitations").update({ status: "expired" }).eq("id", invitation.id);
    return json({ error: "Invitation has expired." }, 410);
  }

  const email = (auth.user.email ?? "").toLowerCase();
  if (email !== String(invitation.invited_email).toLowerCase()) {
    return json({ error: "This invitation was issued for a different email address." }, 403);
  }

  const { data: existingMembership } = await context.adminClient
    .from("team_members")
    .select("team_id, status")
    .eq("user_id", auth.user.id)
    .in("status", ["active", "invited"])
    .neq("team_id", invitation.team_id)
    .limit(1);

  if ((existingMembership ?? []).length > 0) {
    return json({ error: "You are already in another team. Leave that team before joining a new one." }, 409);
  }

  const { data: team } = await context.adminClient.from("teams").select("*").eq("id", invitation.team_id).maybeSingle();
  if (!team || team.deleted_at) return json({ error: "Team no longer exists." }, 404);

  const seatsUsed = await getSeatCount(context.adminClient, invitation.team_id);
  if (seatsUsed >= team.max_members) {
    return json({ error: "Team is at capacity." }, 409);
  }

  await context.adminClient.from("team_members").upsert({
    team_id: invitation.team_id,
    user_id: auth.user.id,
    role: invitation.role === "owner" ? "admin" : invitation.role,
    invited_by: invitation.invited_by,
    joined_at: new Date().toISOString(),
    status: "active",
  }, { onConflict: "team_id,user_id" });

  await context.adminClient
    .from("team_invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  await ensureTeamQuota(context.adminClient, invitation.team_id, teamRunLimit(team.plan));
  await logTeamActivity(context.adminClient, invitation.team_id, auth.user.id, "invite_accepted", "team_invitation", invitation.id, {
    email,
    role: invitation.role,
  });

  return json({ success: true, redirectTo: "/team" });
}

async function declineInvitation(context: RequestContext, token: string) {
  const invitation = await getInvitationByToken(context.adminClient, token);
  if (!invitation) return json({ error: "Invitation not found" }, 404);

  await context.adminClient
    .from("team_invitations")
    .update({
      status: "declined",
      declined_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);

  if (context.user) {
    await logTeamActivity(context.adminClient, invitation.team_id, context.user.id, "invite_declined", "team_invitation", invitation.id, {
      invitedEmail: invitation.invited_email,
    });
  }

  return json({ success: true });
}

async function getActivity(context: RequestContext, teamId: string, url: URL) {
  const access = await requireTeamAccess(context, teamId, "member");
  if (access.response) return access.response;

  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const action = String(url.searchParams.get("action") ?? "").trim();
  const actorId = String(url.searchParams.get("actorId") ?? "").trim();
  const from = (page - 1) * 30;
  const to = from + 29;

  let query = context.adminClient
    .from("team_activity_logs")
    .select("*", { count: "exact" })
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (action) query = query.eq("action", action);
  if (actorId) query = query.eq("actor_id", actorId);

  const { data, count, error } = await query;
  if (error) return json({ error: error.message }, 400);

  return json({
    success: true,
    page,
    pageSize: 30,
    total: count ?? 0,
    items: data ?? [],
    hasMore: typeof count === "number" ? count > to + 1 : false,
  });
}

async function requireTeamAccess(context: RequestContext, teamId: string, minimumRole: "member" | "admin" | "owner") {
  const auth = await requireUser(context);
  if (!auth.ok) return { response: auth.response };

  const member = await getMember(context.adminClient, teamId, auth.user.id);
  if (!member || !["active", "invited"].includes(member.status)) {
    return { response: json({ error: "You do not have access to this team." }, 403) };
  }

  const rank = { member: 1, admin: 2, owner: 3, invited: 0 } as const;
  const memberRank = member.status === "invited" ? 0 : rank[member.role];
  const requiredRank = rank[minimumRole];
  if (memberRank < requiredRank) {
    return { response: json({ error: "Forbidden" }, 403) };
  }

  return { user: auth.user, member };
}

async function getMember(adminClient: ReturnType<typeof createClient>, teamId: string, userId: string) {
  const { data } = await adminClient
    .from("team_members")
    .select("*")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  return data as MemberRow | null;
}

async function fetchMembers(adminClient: ReturnType<typeof createClient>, teamId: string) {
  const { data: members } = await adminClient
    .from("team_members")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  const memberRows = (members ?? []) as MemberRow[];
  const userIds = memberRows.map((row) => row.user_id);
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, name, email, avatar_url")
    .in("id", userIds);

  const usage = await adminClient
    .from("team_member_usage_breakdown")
    .select("*")
    .eq("team_id", teamId);

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const usageMap = new Map((usage.data ?? []).map((row) => [row.user_id, row]));

  return memberRows.map((member) => {
    const profile = profileMap.get(member.user_id);
    const usageRow = usageMap.get(member.user_id) as { runs_used?: number; last_active_at?: string | null } | undefined;
    return {
      ...member,
      profile,
      runsUsed: Number(usageRow?.runs_used ?? 0),
      lastActiveAt: usageRow?.last_active_at ?? null,
    };
  });
}

async function getInvitationByToken(adminClient: ReturnType<typeof createClient>, token: string) {
  const { data } = await adminClient.from("team_invitations").select("*").eq("token", token).maybeSingle();
  return data as {
    id: string;
    team_id: string;
    invited_email: string;
    invited_by: string;
    role: TeamRole;
    status: InviteStatus;
    expires_at: string;
  } | null;
}

async function getSeatCount(adminClient: ReturnType<typeof createClient>, teamId: string) {
  const { count } = await adminClient
    .from("team_members")
    .select("*", { count: "exact", head: true })
    .eq("team_id", teamId)
    .in("status", ["active", "invited"]);
  return count ?? 0;
}

async function getUserProfile(adminClient: ReturnType<typeof createClient>, userId: string) {
  const { data } = await adminClient
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data as { performance_plan?: string | null } | null;
}

async function resolveEligibleTeamPlan(adminClient: ReturnType<typeof createClient>, user: User) {
  const profile = await getUserProfile(adminClient, user.id);
  const profilePlan = normalizeTeamPlan(profile?.performance_plan);
  if (profilePlan) return profilePlan;

  const metadataPlan = normalizeTeamPlan(
    String(
      user.user_metadata?.performance_plan ??
      user.app_metadata?.performance_plan ??
      "",
    ),
  );

  if (metadataPlan) {
    // Backfill a missing user_profiles row so future checks are consistent.
    await adminClient.from("user_profiles").upsert({
      id: user.id,
      email: user.email ?? "",
      performance_plan: metadataPlan,
    }, { onConflict: "id" });
    return metadataPlan;
  }

  const billingPlan = await resolvePlanFromBilling(adminClient, user.id);
  if (billingPlan) {
    await adminClient.from("user_profiles").upsert({
      id: user.id,
      email: user.email ?? "",
      performance_plan: billingPlan,
    }, { onConflict: "id" });
    return billingPlan;
  }

  return null;
}

async function resolvePlanFromBilling(adminClient: ReturnType<typeof createClient>, userId: string) {
  const { data: subscription } = await adminClient
    .from("subscriptions")
    .select("plan, status, updated_at, created_at")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const subscriptionPlan = normalizeTeamPlan(String(subscription?.plan ?? ""));
  if (subscriptionPlan) return subscriptionPlan;

  const { data: payment } = await adminClient
    .from("payments")
    .select("plan_name, pack_name, status, created_at")
    .eq("user_id", userId)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const paymentPlan =
    normalizeTeamPlan(String(payment?.plan_name ?? "")) ??
    normalizeTeamPlan(String(payment?.pack_name ?? ""));

  if (paymentPlan) return paymentPlan;
  return null;
}

async function ensureTeamQuota(adminClient: ReturnType<typeof createClient>, teamId: string, runLimit: number) {
  await adminClient.rpc("ensure_team_quota_cycle", {
    p_team_id: teamId,
    p_run_limit: runLimit,
  });
}

async function logTeamActivity(
  adminClient: ReturnType<typeof createClient>,
  teamId: string,
  actorId: string,
  action: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
) {
  await adminClient.rpc("log_team_activity", {
    p_team_id: teamId,
    p_actor_id: actorId,
    p_action: action,
    p_resource_type: resourceType ?? null,
    p_resource_id: resourceId ?? null,
    p_metadata: metadata ?? {},
  });
}

async function findUserByEmail(adminClient: ReturnType<typeof createClient>, email: string) {
  const pageSize = 1000;
  let page = 1;
  while (page < 5) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: pageSize });
    if (error) return null;
    const match = data.users.find((user) => (user.email ?? "").toLowerCase() === email);
    if (match) return match;
    if (data.users.length < pageSize) break;
    page += 1;
  }
  return null;
}

async function getUserEmail(adminClient: ReturnType<typeof createClient>, userId: string) {
  const { data } = await adminClient.from("profiles").select("email").eq("id", userId).maybeSingle();
  return data?.email ? String(data.email).toLowerCase() : "";
}

function normalizeTeamPlan(value: string | null | undefined): TeamPlan | null {
  const plan = String(value ?? "").trim().toLowerCase();
  if (plan === "pro" || plan === "enterprise") return plan;
  return null;
}

function normalizePersonalPlan(value: string | null | undefined) {
  const plan = String(value ?? "").trim().toLowerCase();
  if (plan === "pro" || plan === "enterprise") return plan;
  return "standard";
}

function normalizeRole(value: unknown): TeamRole {
  const role = String(value ?? "member").trim().toLowerCase();
  if (role === "owner" || role === "admin") return role;
  return "member";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function getBaseAppUrl() {
  return (Deno.env.get("SITE_URL") ?? Deno.env.get("APP_URL") ?? "http://localhost:5173").replace(/\/+$/, "");
}
