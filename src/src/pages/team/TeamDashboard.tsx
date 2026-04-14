import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";
import { TeamActivityFeed } from "@/components/team/TeamActivityFeed";
import { TeamMembersTable } from "@/components/team/TeamMembersTable";
import { TeamQuotaCard } from "@/components/team/TeamQuotaCard";
import {
  changeTeamMemberRole,
  createTeam,
  deleteTeam,
  fetchMyTeam,
  inviteTeamMember,
  removeTeamMember,
  revokeInvitation,
  transferOwnership,
  updateTeam,
} from "@/components/team/api";
import type { TeamDetailsResponse } from "@/components/team/types";

export default function TeamDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payload, setPayload] = useState<TeamDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftSlug, setDraftSlug] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const next = await fetchMyTeam();
      setPayload(next);
      if (next.team) {
        setDraftName(next.team.name);
        setDraftSlug(next.team.slug);
      }
    } catch (error) {
      toast({ title: "Failed to load team", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-10 text-sm text-muted-foreground">Loading team workspace...</div>
      </div>
    );
  }

  const team = payload?.team;
  const members = payload?.members ?? [];
  const invites = payload?.pendingInvitations ?? [];
  const permissions = payload?.permissions;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container space-y-6 py-8">
        {!team ? (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Create a team</CardTitle>
              <CardDescription>
                Standard plans stay solo. Pro supports up to 4 seats, Enterprise supports up to 5 seats.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Detected plan: <span className="font-medium capitalize">{payload?.eligiblePlan ?? "standard"}</span></p>
              <div className="space-y-2">
                <Label htmlFor="team-name">Team name</Label>
                <Input id="team-name" value={draftName} onChange={(event) => setDraftName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-slug">Team slug</Label>
                <Input id="team-slug" value={draftSlug} onChange={(event) => setDraftSlug(event.target.value)} />
              </div>
              <Button
                disabled={(payload?.eligiblePlan ?? "standard") === "standard" || !draftName.trim()}
                onClick={async () => {
                  try {
                    await createTeam({ name: draftName, slug: draftSlug });
                    toast({ title: "Team created" });
                    await load();
                  } catch (error) {
                    toast({ title: "Unable to create team", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
                  }
                }}
              >
                Create team
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-3xl">{team.name}</CardTitle>
                    <CardDescription>@{team.slug}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{team.plan}</Badge>
                    {permissions?.isOwner && <Badge variant="secondary">Owner</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Team name</Label>
                      <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Team slug</Label>
                      <Input value={draftSlug} disabled />
                    </div>
                  </div>
                  {(permissions?.role === "owner" || permissions?.role === "admin") && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            await updateTeam(team.id, { name: draftName });
                            toast({ title: "Team updated" });
                            await load();
                          } catch (error) {
                            toast({ title: "Update failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
                          }
                        }}
                      >
                        Save changes
                      </Button>
                      <Button variant="outline" disabled={members.length >= team.max_members} onClick={() => setInviteOpen(true)}>
                        Invite member
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <TeamQuotaCard quota={payload?.quota ?? null} members={members} currentUserId={user?.id} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <TeamMembersTable
                  currentUserId={user?.id}
                  members={members}
                  canManage={Boolean(permissions?.role)}
                  isOwner={Boolean(permissions?.isOwner)}
                  onRemove={async (userId) => {
                    await removeTeamMember(team.id, userId);
                    toast({ title: userId === user?.id ? "You left the team" : "Member removed" });
                    await load();
                  }}
                  onPromote={async (userId, role) => {
                    await changeTeamMemberRole(team.id, userId, role);
                    toast({ title: "Role updated" });
                    await load();
                  }}
                  onTransfer={async (userId) => {
                    await transferOwnership(team.id, userId);
                    toast({ title: "Ownership transferred" });
                    await load();
                  }}
                />

                <TeamActivityFeed teamId={team.id} />
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Pending invitations</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {invites.length === 0 && <p className="text-sm text-muted-foreground">No pending invites.</p>}
                    {invites.map((invite) => (
                      <div key={invite.id} className="rounded-xl border p-3">
                        <p className="font-medium">{invite.invited_email}</p>
                        <p className="text-xs text-muted-foreground">
                          {invite.role} • expires {new Date(invite.expires_at).toLocaleString()}
                        </p>
                        {permissions?.canInvite && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3"
                            onClick={async () => {
                              await revokeInvitation(team.id, invite.id);
                              toast({ title: "Invitation revoked" });
                              await load();
                            }}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                    <CardDescription>Owner-only billing context</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>Plan: <span className="font-medium capitalize">{team.plan}</span></p>
                    <p>Seats: <span className="font-medium">{members.filter((member) => member.status === "active").length} of {team.max_members}</span></p>
                    <p>Runs: <span className="font-medium">{payload?.quota?.runs_used ?? 0} of {payload?.quota?.run_limit ?? 0}</span></p>
                    <p>Reset date: <span className="font-medium">{payload?.quota?.reset_at ? new Date(payload.quota.reset_at).toLocaleDateString() : "-"}</span></p>
                    {permissions?.isOwner && team.plan === "pro" && (
                      <Button variant="outline" className="w-full">Upgrade to Enterprise</Button>
                    )}
                  </CardContent>
                </Card>

                {permissions?.isOwner && (
                  <Card className="border-destructive/30">
                    <CardHeader>
                      <CardTitle>Danger zone</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Dissolving the team removes members and revokes outstanding invitations.
                      </p>
                      <Button
                        variant="destructive"
                        onClick={async () => {
                          const confirmText = window.prompt(`Type ${team.slug} to dissolve this team`) ?? "";
                          if (!confirmText) return;
                          await deleteTeam(team.id, confirmText);
                          toast({ title: "Team dissolved" });
                          await load();
                        }}
                      >
                        Dissolve team
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            <InviteMemberDialog
              open={inviteOpen}
              onOpenChange={setInviteOpen}
              seatsUsed={members.filter((member) => member.status === "active").length + invites.length}
              seatsTotal={team.max_members}
              disabled={members.filter((member) => member.status === "active").length + invites.length >= team.max_members}
              onSubmit={async (invite) => {
                await inviteTeamMember(team.id, invite);
                toast({ title: "Invitation sent" });
                await load();
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
