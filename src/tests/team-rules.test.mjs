import test from "node:test";
import assert from "node:assert/strict";
import { canInviteMember, canReserveTeamQuota, canTransferOwnership, maxMembersForPlan } from "../src/lib/team-rules.ts";

test("member limit enforces Pro and Enterprise seat caps", () => {
  assert.equal(maxMembersForPlan("pro"), 4);
  assert.equal(maxMembersForPlan("enterprise"), 5);
  assert.equal(canInviteMember({ plan: "pro", activeMembers: 3, pendingInvites: 0 }), true);
  assert.equal(canInviteMember({ plan: "pro", activeMembers: 3, pendingInvites: 1 }), false);
  assert.equal(canInviteMember({ plan: "enterprise", activeMembers: 4, pendingInvites: 0 }), true);
  assert.equal(canInviteMember({ plan: "enterprise", activeMembers: 4, pendingInvites: 1 }), false);
});

test("quota enforcement blocks reservations when shared team quota is exhausted", () => {
  assert.equal(canReserveTeamQuota({ runLimit: 500, runsUsed: 499 }), true);
  assert.equal(canReserveTeamQuota({ runLimit: 500, runsUsed: 500 }), false);
  assert.equal(canReserveTeamQuota({ runLimit: 950, runsUsed: 950 }), false);
});

test("ownership transfer only allows a different active member", () => {
  assert.equal(canTransferOwnership({
    currentOwnerId: "owner-1",
    nextOwnerId: "member-2",
    nextOwnerStatus: "active",
  }), true);

  assert.equal(canTransferOwnership({
    currentOwnerId: "owner-1",
    nextOwnerId: "owner-1",
    nextOwnerStatus: "active",
  }), false);

  assert.equal(canTransferOwnership({
    currentOwnerId: "owner-1",
    nextOwnerId: "member-3",
    nextOwnerStatus: "invited",
  }), false);
});
