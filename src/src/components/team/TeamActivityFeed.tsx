import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchTeamActivity } from "./api";
import type { TeamActivityPage } from "./types";

export function TeamActivityFeed({ teamId }: { teamId: string }) {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<TeamActivityPage | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchTeamActivity(teamId, page, action || undefined, actorId || undefined)
      .then((next) => {
        if (!cancelled) setPayload(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId, page, action, actorId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Activity feed</CardTitle>
        <div className="flex gap-2">
          <Input
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="Filter by action"
            className="w-40"
          />
          <Input
            value={actorId}
            onChange={(event) => setActorId(event.target.value)}
            placeholder="Filter by member id"
            className="w-40"
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading activity...</p>}
        {(payload?.items ?? []).map((item) => (
          <div key={item.id} className="rounded-xl border p-3">
            <p className="text-sm font-medium">{formatActivity(item.action, item.metadata)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p>
          </div>
        ))}
        {!loading && (payload?.items ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        )}
        <div className="flex justify-between">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Previous
          </Button>
          <Button variant="outline" disabled={!payload?.hasMore} onClick={() => setPage((current) => current + 1)}>
            Load more
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatActivity(action: string, metadata: Record<string, unknown>) {
  if (action === "member_invited") return `Invitation sent to ${String(metadata.invitedEmail ?? "member")}`;
  if (action === "member_removed") return `A member was removed by admin`;
  if (action === "member_left") return `A member left the team`;
  if (action === "ownership_transferred") return `Ownership transferred`;
  if (action === "team_created") return `Team created`;
  if (action === "invite_accepted") return `Invitation accepted by ${String(metadata.email ?? "member")}`;
  return action.replaceAll("_", " ");
}
