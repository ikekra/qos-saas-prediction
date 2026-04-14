import type { User } from "https://esm.sh/@supabase/supabase-js@2";
import { getPerformanceQuotaState, reservePerformanceRun } from "./performance-run-quota.ts";

type AdminClient = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function checkTeamQuota(adminClient: AdminClient, user: User, reserve = false) {
  const quota = reserve
    ? await reservePerformanceRun(adminClient as never, user)
    : await getPerformanceQuotaState(adminClient as never, user);

  return {
    quota,
    allowed: !quota.exhaustedMessage,
    shared: quota.scopeType === "team",
  };
}
