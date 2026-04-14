export type TeamMemberRecord = {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  status: "active" | "invited" | "suspended" | "removed";
  joined_at: string | null;
  profile?: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  };
  runsUsed: number;
  lastActiveAt: string | null;
};

export type TeamInvitationRecord = {
  id: string;
  invited_email: string;
  role: "owner" | "admin" | "member";
  status: "pending" | "accepted" | "declined" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
};

export type TeamQuotaRecord = {
  team_id: string;
  team_name: string;
  plan: "pro" | "enterprise";
  max_members: number;
  cycle_start_date: string;
  cycle_end_date: string;
  run_limit: number;
  runs_used: number;
  runs_remaining: number;
  reset_at: string;
};

export type TeamDetailsResponse = {
  success: boolean;
  team: {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    plan: "pro" | "enterprise";
    max_members: number;
    avatar_url: string | null;
  } | null;
  members: TeamMemberRecord[];
  pendingInvitations: TeamInvitationRecord[];
  quota: TeamQuotaRecord | null;
  usageByMember: Array<{ user_id: string; runs_used: number; last_active_at: string | null }>;
  permissions?: {
    role: "owner" | "admin" | "member";
    isOwner: boolean;
    canInvite: boolean;
    canViewActivity: boolean;
  };
  eligiblePlan?: "standard" | "pro" | "enterprise";
};

export type TeamActivityPage = {
  success: boolean;
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: string;
    actor_id: string;
    action: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  hasMore: boolean;
};
