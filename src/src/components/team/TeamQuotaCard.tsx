import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { TeamMemberRecord, TeamQuotaRecord } from "./types";

export function TeamQuotaCard({ quota, members, currentUserId }: {
  quota: TeamQuotaRecord | null;
  members: TeamMemberRecord[];
  currentUserId?: string;
}) {
  if (!quota) {
    return (
      <Card>
        <CardHeader><CardTitle>Shared quota</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Quota details will appear after the first cycle starts.</p></CardContent>
      </Card>
    );
  }

  const percent = quota.run_limit > 0 ? Math.round((quota.runs_used / quota.run_limit) * 100) : 0;
  const myUsage = members.find((member) => member.user_id === currentUserId)?.runsUsed ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shared quota</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-2xl font-semibold">{quota.runs_used} of {quota.run_limit} runs used</p>
          <p className="text-sm text-muted-foreground">Reset on {new Date(quota.reset_at).toLocaleDateString()}</p>
        </div>
        <Progress value={percent} />
        <div className="rounded-xl border p-3 text-sm">
          <p className="font-medium">By member</p>
          <div className="mt-2 space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between">
                <span>{member.profile?.name || member.profile?.email || member.user_id}</span>
                <span>{member.runsUsed} runs</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Your contribution this cycle: {myUsage} runs</p>
      </CardContent>
    </Card>
  );
}
