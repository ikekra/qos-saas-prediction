import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TeamMemberRecord } from "./types";

export function TeamMembersTable(props: {
  currentUserId?: string;
  members: TeamMemberRecord[];
  canManage: boolean;
  isOwner: boolean;
  onRemove: (userId: string) => Promise<void>;
  onPromote: (userId: string, role: "admin" | "member") => Promise<void>;
  onTransfer: (userId: string) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.members.map((member) => {
          const isSelf = props.currentUserId === member.user_id;
          return (
            <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
              <div>
                <p className="font-medium">
                  {member.profile?.name || member.profile?.email || member.user_id}
                  {member.role === "owner" && " (Owner)"}
                </p>
                <p className="text-sm text-muted-foreground">{member.profile?.email || member.user_id}</p>
                <p className="text-xs text-muted-foreground">
                  Joined {member.joined_at ? new Date(member.joined_at).toLocaleDateString() : "Pending"} • Last active{" "}
                  {member.lastActiveAt ? new Date(member.lastActiveAt).toLocaleString() : "Never"} • Runs {member.runsUsed}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{member.role}</Badge>
                <Badge variant={member.status === "active" ? "outline" : "secondary"}>{member.status}</Badge>
                {props.canManage && member.role !== "owner" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => props.onPromote(member.user_id, member.role === "admin" ? "member" : "admin")}>
                      {member.role === "admin" ? "Make member" : "Make admin"}
                    </Button>
                    {props.isOwner && (
                      <Button size="sm" variant="outline" onClick={() => props.onTransfer(member.user_id)}>
                        Transfer ownership
                      </Button>
                    )}
                    <Button size="sm" variant={isSelf ? "outline" : "destructive"} onClick={() => props.onRemove(member.user_id)}>
                      {isSelf ? "Leave team" : "Remove"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
