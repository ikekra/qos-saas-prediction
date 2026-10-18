export type TeamPlan = "pro" | "enterprise";

export function maxMembersForPlan(plan: TeamPlan) {
  return plan === "enterprise" ? 5 : 4;
}

export function canInviteMember(params: {
  plan: TeamPlan;
  activeMembers: number;
  pendingInvites: number;
}) {
  return params.activeMembers + params.pendingInvites < maxMembersForPlan(params.plan);
}

export function canReserveTeamQuota(params: {
  runLimit: number;
  runsUsed: number;
}) {
  return params.runsUsed < params.runLimit;
}

export function canTransferOwnership(params: {
  currentOwnerId: string;
  nextOwnerId: string;
  nextOwnerStatus: "active" | "invited" | "suspended" | "removed";
}) {
  return params.currentOwnerId !== params.nextOwnerId && params.nextOwnerStatus === "active";
}
