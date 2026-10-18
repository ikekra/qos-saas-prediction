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

function slugifyTeam(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

type TeamCreateFormErrors = {
  name?: string;
  slug?: string;
};

function validateTeamCreateForm(name: string, slug: string): TeamCreateFormErrors {
  const errors: TeamCreateFormErrors = {};
  const trimmedName = name.trim();
  const normalizedSlug = slugifyTeam(slug);

  if (!trimmedName) {
    errors.name = "Team name is required.";
  } else if (trimmedName.length < 2 || trimmedName.length > 100) {
    errors.name = "Team name must be between 2 and 100 characters.";
  }

  if (!normalizedSlug) {
    errors.slug = "Team slug is required.";
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
    errors.slug = "Use lowercase letters, numbers, and hyphens only.";
  }

  return errors;
}

export default function TeamDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [payload, setPayload] = useState<TeamDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [teamCreateErrors, setTeamCreateErrors] = useState<TeamCreateFormErrors>({});
  const [slugEdited, setSlugEdited] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const next = await fetchMyTeam();
      setPayload(next);
      if (next.team) {
        setDraftName(next.team.name);
        setDraftSlug(next.team.slug);
        setSlugEdited(true);
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
                Standard process: enter a team name, confirm slug, then create your workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Detected plan: <span className="font-medium capitalize">{payload?.eligiblePlan ?? "standard"}</span></p>
              <div className="space-y-2">
                <Label htmlFor="team-name">Team name</Label>
                <Input
                  id="team-name"
                  value={draftName}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setDraftName(nextName);
                    if (!slugEdited) {
                      setDraftSlug(slugifyTeam(nextName));
                    }
                    if (teamCreateErrors.name) {
                      setTeamCreateErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                />
                {teamCreateErrors.name && (
                  <p className="text-xs text-destructive">{teamCreateErrors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-slug">Team slug</Label>
                <Input
                  id="team-slug"
                  value={draftSlug}
                  onChange={(event) => {
                    setSlugEdited(true);
                    setDraftSlug(slugifyTeam(event.target.value));
                    if (teamCreateErrors.slug) {
                      setTeamCreateErrors((prev) => ({ ...prev, slug: undefined }));
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only.</p>
                {teamCreateErrors.slug && (
                  <p className="text-xs text-destructive">{teamCreateErrors.slug}</p>
                )}
              </div>
              <Button
                disabled={(payload?.eligiblePlan ?? "standard") === "standard" || isCreatingTeam}
                onClick={async () => {
                  const finalName = draftName.trim();
                  const finalSlug = slugifyTeam(draftSlug || draftName);
                  const validation = validateTeamCreateForm(finalName, finalSlug);

                  if (validation.name || validation.slug) {
                    setTeamCreateErrors(validation);
                    return;
                  }

                  try {
                    setIsCreatingTeam(true);
                    setTeamCreateErrors({});
                    await createTeam({ name: finalName, slug: finalSlug });
                    toast({ title: "Team created" });
                    await load();
                  } catch (error) {
                    toast({ title: "Unable to create team", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
                  } finally {
                    setIsCreatingTeam(false);
                  }
                }}
              >
                {isCreatingTeam ? "Creating..." : "Create team"}
              </Button>
              {(payload?.eligiblePlan ?? "standard") === "standard" && (
                <p className="text-xs text-muted-foreground">Upgrade to Pro or Enterprise to enable team workspaces.</p>
              )}
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
                          {invite.role} | expires {new Date(invite.expires_at).toLocaleString()}
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
