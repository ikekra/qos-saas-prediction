import { authFunctionFetch } from "@/lib/live-token";
import type { TeamActivityPage, TeamDetailsResponse } from "./types";

async function parseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || "Request failed");
  }
  return payload as T;
}

export async function fetchMyTeam() {
  const response = await authFunctionFetch("team-api", "/api/teams/me");
  return parseJson<TeamDetailsResponse>(response);
}

export async function createTeam(payload: { name: string; slug?: string; avatarUrl?: string | null }) {
  const response = await authFunctionFetch("team-api", "/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<{ success: boolean }>(response);
}

export async function updateTeam(teamId: string, payload: { name?: string; avatarUrl?: string | null }) {
  const response = await authFunctionFetch("team-api", `/api/teams/${teamId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<{ success: boolean }>(response);
}

export async function deleteTeam(teamId: string, confirmText: string) {
  const response = await authFunctionFetch("team-api", `/api/teams/${teamId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmText }),
  });
  return parseJson<{ success: boolean }>(response);
}

export async function inviteTeamMember(teamId: string, payload: { email: string; role: "admin" | "member" }) {
  const response = await authFunctionFetch("team-api", `/api/teams/${teamId}/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<{ success: boolean }>(response);
}

export async function revokeInvitation(teamId: string, inviteId: string) {
  const response = await authFunctionFetch("team-api", `/api/teams/${teamId}/invitations/${inviteId}`, {
    method: "DELETE",
  });
  return parseJson<{ success: boolean }>(response);
}

export async function removeTeamMember(teamId: string, userId: string) {
  const response = await authFunctionFetch("team-api", `/api/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
  });
  return parseJson<{ success: boolean }>(response);
}

export async function changeTeamMemberRole(teamId: string, userId: string, role: "admin" | "member") {
  const response = await authFunctionFetch("team-api", `/api/teams/${teamId}/members/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  return parseJson<{ success: boolean }>(response);
}

export async function transferOwnership(teamId: string, nextOwnerUserId: string) {
  const response = await authFunctionFetch("team-api", `/api/teams/${teamId}/transfer-ownership`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nextOwnerUserId }),
  });
  return parseJson<{ success: boolean }>(response);
}

export async function fetchTeamActivity(teamId: string, page: number, action?: string, actorId?: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (action) params.set("action", action);
  if (actorId) params.set("actorId", actorId);
  const response = await authFunctionFetch("team-api", `/api/teams/${teamId}/activity?${params.toString()}`);
  return parseJson<TeamActivityPage>(response);
}

export async function fetchInvitation(token: string) {
  const response = await authFunctionFetch("team-api", `/api/invitations/${token}`);
  return parseJson<{
    success: boolean;
    invitation: {
      invited_email: string;
      role: "admin" | "member";
      status: string;
      expires_at: string;
    };
    team: { id: string; name: string; plan: "pro" | "enterprise" } | null;
  }>(response);
}

export async function acceptInvitation(token: string) {
  const response = await authFunctionFetch("team-api", `/api/invitations/${token}/accept`, {
    method: "POST",
  });
  return parseJson<{ success: boolean; redirectTo: string }>(response);
}

export async function declineInvitation(token: string) {
  const response = await authFunctionFetch("team-api", `/api/invitations/${token}/decline`, {
    method: "POST",
  });
  return parseJson<{ success: boolean }>(response);
}
