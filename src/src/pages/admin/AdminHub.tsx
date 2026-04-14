import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { authFunctionFetch } from "@/lib/live-token";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type OverviewPayload = {
  success: boolean;
  refreshedAt: string;
  business: {
    totalUsers: number;
    newUsersToday: number;
    mrrInr: number;
    totalRevenueInr: number;
    activePaidSubscriptions: { standard: number; pro: number; enterprise: number };
    arpuInr: number;
  };
  usage: {
    testsToday: number;
    testsMonth: number;
    avgRunsPerUserPerDay: number;
    usersHittingQuota: number;
  };
  teams: {
    totalTeams: number;
    averageTeamSize: number;
    teamsAtMaxCapacity: number;
    teamsWithNoActivityIn30Days: number;
  };
  health: {
    apiP50: number;
    apiP95: number;
    errorRate: number;
    dbPoolUsage: number;
    queueDepth: number;
    lastSuccessfulWebhook: string | null;
  };
};

export default function AdminHub() {
  const { toast } = useToast();
  const [payload, setPayload] = useState<OverviewPayload | null>(null);

  const load = async () => {
    const response = await authFunctionFetch("admin-control-plane", "/api/admin/overview");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to load admin overview");
    setPayload(data);
  };

  useEffect(() => {
    void load().catch((error) => {
      toast({ title: "Failed to load admin overview", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
    });

    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container space-y-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Admin control plane</h1>
            <p className="text-sm text-muted-foreground">
              {payload?.refreshedAt ? `Last updated ${new Date(payload.refreshedAt).toLocaleTimeString()}` : "Loading live metrics..."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/users"><Button variant="outline">Users</Button></Link>
            <Link to="/admin/payments"><Button variant="outline">Payments</Button></Link>
            <Link to="/admin/audit"><Button variant="outline">Audit</Button></Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total users" value={String(payload?.business.totalUsers ?? 0)} />
          <MetricCard title="New users today" value={String(payload?.business.newUsersToday ?? 0)} />
          <MetricCard title="MRR" value={money(payload?.business.mrrInr ?? 0)} />
          <MetricCard title="Total revenue" value={money(payload?.business.totalRevenueInr ?? 0)} />
          <MetricCard title="Tests today" value={String(payload?.usage.testsToday ?? 0)} />
          <MetricCard title="Tests this month" value={String(payload?.usage.testsMonth ?? 0)} />
          <MetricCard title="Total teams" value={String(payload?.teams.totalTeams ?? 0)} />
          <MetricCard title="Avg team size" value={String(payload?.teams.averageTeamSize ?? 0)} />
          <MetricCard title="API P50 / P95" value={`${payload?.health.apiP50 ?? 0} / ${payload?.health.apiP95 ?? 0} ms`} />
          <MetricCard title="Error rate" value={`${payload?.health.errorRate ?? 0}%`} />
          <MetricCard title="DB pool usage" value={`${payload?.health.dbPoolUsage ?? 0}%`} />
          <MetricCard title="Queue depth" value={String(payload?.health.queueDepth ?? 0)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Plan distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Standard: {payload?.business.activePaidSubscriptions.standard ?? 0}</p>
              <p>Pro: {payload?.business.activePaidSubscriptions.pro ?? 0}</p>
              <p>Enterprise: {payload?.business.activePaidSubscriptions.enterprise ?? 0}</p>
              <p>ARPU: {money(payload?.business.arpuInr ?? 0)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Teams at max capacity: {payload?.teams.teamsAtMaxCapacity ?? 0}</p>
              <p>Inactive 30+ days: {payload?.teams.teamsWithNoActivityIn30Days ?? 0}</p>
              <p>Users hitting quota today: {payload?.usage.usersHittingQuota ?? 0}</p>
              <p>Avg runs per user per day: {payload?.usage.avgRunsPerUserPerDay ?? 0}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
