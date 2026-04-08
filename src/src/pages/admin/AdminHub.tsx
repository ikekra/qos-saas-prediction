import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { invokeWithLiveToken, extractFunctionErrorMessage } from "@/lib/live-token";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, Users, Database, ReceiptText, Coins } from "lucide-react";

type AdminTab = "overview" | "users" | "services" | "audit";

type LiveUserRow = {
  id: string;
  name: string;
  email: string;
  plan: string;
  tokens: number;
  status: "Active" | "Pending" | "Suspended" | "Low tokens";
  is_owner: boolean;
};

type ServiceRow = {
  id: string;
  name: string;
  provider: string;
  category: string;
  is_active: boolean;
  updated_at: string | null;
};

type AuditRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  target_email: string | null;
  target_user_id: string | null;
  status: string;
  reason: string | null;
};

type AdminHubResponse = {
  success: boolean;
  summary: {
    total_users: number;
    active_users: number;
    pending_users: number;
    suspended_users: number;
  };
  token_summary: {
    total_token_balance: number;
    total_lifetime_tokens_used: number;
  };
  services_summary: {
    total_services: number;
    active_services: number;
    inactive_services: number;
  };
  users: LiveUserRow[];
  services: ServiceRow[];
  recent_audit: AuditRow[];
};

function statusClass(status: string) {
  if (status === "Active") return "bg-emerald-500/15 text-emerald-200 border-emerald-400/30";
  if (status === "Pending") return "bg-amber-500/15 text-amber-200 border-amber-400/30";
  if (status === "Suspended") return "bg-rose-500/15 text-rose-200 border-rose-400/30";
  return "bg-orange-500/15 text-orange-200 border-orange-400/30";
}

export default function AdminHub() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [query, setQuery] = useState("");
  const [payload, setPayload] = useState<AdminHubResponse | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  const fetchHub = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeWithLiveToken<AdminHubResponse>("admin-user-management?limit=200");
      if (error) throw error;
      if (!data?.success) throw new Error("Failed to load admin hub data");
      setPayload(data);
    } catch (err: unknown) {
      const message = await extractFunctionErrorMessage(err, "Failed to load admin dashboard");
      toast({ title: "Load failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void fetchHub();
    }, 350);
  }, [fetchHub]);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchHub();
  }, [fetchHub, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel(`admin-hub-live-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_profiles" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "token_transactions" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "web_services" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_audit_logs" }, scheduleRefresh)
      .subscribe();

    const pollTimer = window.setInterval(() => void fetchHub(), 30000);

    return () => {
      window.clearInterval(pollTimer);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [fetchHub, isAdmin, scheduleRefresh]);

  const users = payload?.users ?? [];
  const services = payload?.services ?? [];
  const auditRows = payload?.recent_audit ?? [];

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((row) => `${row.name} ${row.email} ${row.id} ${row.plan}`.toLowerCase().includes(q));
  }, [query, users]);

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((row) => `${row.name} ${row.provider} ${row.category}`.toLowerCase().includes(q));
  }, [query, services]);

  const runUserAction = async (targetUserId: string, action: "verify" | "suspend" | "reactivate" | "reject") => {
    setActionLoadingId(`${targetUserId}:${action}`);
    try {
      const { data, error } = await invokeWithLiveToken<{ success: boolean }>("admin-user-management", {
        body: {
          target_user_id: targetUserId,
          action,
          reason: `Admin hub action: ${action}`,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error("Action failed");
      toast({ title: `User ${action} successful` });
      await fetchHub();
    } catch (err: unknown) {
      const message = await extractFunctionErrorMessage(err, `Failed to ${action} user`);
      toast({ title: "Action failed", description: message, variant: "destructive" });
    } finally {
      setActionLoadingId("");
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-10">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">Admin access required.</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const tabButton = (id: AdminTab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-xl border px-4 py-2 text-sm ${
        tab === id ? "border-violet-300 bg-violet-200 text-slate-900" : "border-white/20 bg-white/5 text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#07070a] text-slate-100">
      <Header />
      <div className="container py-8 space-y-6">
        <div className="rounded-3xl border border-violet-300/30 bg-gradient-to-r from-[#2f2a56] via-[#463f7f] to-[#6e63b6] p-7 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
                <Shield className="h-3.5 w-3.5" />
                Admin control plane
              </p>
              <h1 className="mt-3 text-3xl font-semibold">Live Admin Hub</h1>
              <p className="mt-1 text-sm text-violet-50/90">Role-separated real-time dashboard for owner actions.</p>
            </div>
            <Button onClick={() => void fetchHub()} className="bg-white text-slate-900 hover:bg-white/90">Refresh</Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabButton("overview", "Overview")}
          {tabButton("users", "Users")}
          {tabButton("services", "Services")}
          {tabButton("audit", "Audit")}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-4">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "services" ? "Search services..." : tab === "audit" ? "Search email/action..." : "Search users..."}
              className="max-w-[440px] border-white/20 bg-black/20 text-slate-100 placeholder:text-slate-400"
            />
          </div>

          {loading ? (
            <div className="py-14 text-center text-slate-300">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading live admin data...
              </span>
            </div>
          ) : tab === "overview" ? (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <Card className="border-white/10 bg-black/20"><CardHeader><CardDescription>Total users</CardDescription><CardTitle>{payload?.summary.total_users ?? 0}</CardTitle></CardHeader></Card>
              <Card className="border-white/10 bg-black/20"><CardHeader><CardDescription>Active users</CardDescription><CardTitle>{payload?.summary.active_users ?? 0}</CardTitle></CardHeader></Card>
              <Card className="border-white/10 bg-black/20"><CardHeader><CardDescription>Suspended</CardDescription><CardTitle>{payload?.summary.suspended_users ?? 0}</CardTitle></CardHeader></Card>
              <Card className="border-white/10 bg-black/20"><CardHeader><CardDescription>Total services</CardDescription><CardTitle>{payload?.services_summary.total_services ?? 0}</CardTitle></CardHeader></Card>
              <Card className="border-white/10 bg-black/20"><CardHeader><CardDescription>Token pool</CardDescription><CardTitle>{new Intl.NumberFormat("en-IN").format(payload?.token_summary.total_token_balance ?? 0)}</CardTitle></CardHeader></Card>
              <Card className="border-white/10 bg-black/20"><CardHeader><CardDescription>Lifetime usage</CardDescription><CardTitle>{new Intl.NumberFormat("en-IN").format(payload?.token_summary.total_lifetime_tokens_used ?? 0)}</CardTitle></CardHeader></Card>

              <Card className="border-white/10 bg-black/20 md:col-span-3">
                <CardHeader>
                  <CardTitle className="text-base">Quick Navigation</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Link to="/admin/tokens"><Button size="sm"><Coins className="mr-1.5 h-4 w-4" />Admin Tokens</Button></Link>
                  <Link to="/admin/web-services"><Button size="sm" variant="outline"><Database className="mr-1.5 h-4 w-4" />Admin Services</Button></Link>
                  <Button size="sm" variant="outline"><Users className="mr-1.5 h-4 w-4" />User Controls</Button>
                  <Button size="sm" variant="outline"><ReceiptText className="mr-1.5 h-4 w-4" />Audit</Button>
                </CardContent>
              </Card>
            </div>
          ) : tab === "users" ? (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[840px] text-left text-sm">
                <thead className="bg-black/25 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Plan</th>
                    <th className="px-3 py-2 font-medium">Tokens</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((row) => {
                    const busy = actionLoadingId.startsWith(row.id);
                    return (
                      <tr key={row.id} className="border-t border-white/10">
                        <td className="px-3 py-3">{row.name}{row.is_owner ? " (Owner)" : ""}</td>
                        <td className="px-3 py-3 text-slate-400">{row.email}</td>
                        <td className="px-3 py-3">{row.plan}</td>
                        <td className="px-3 py-3">{new Intl.NumberFormat("en-IN").format(row.tokens)}</td>
                        <td className="px-3 py-3"><span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(row.status)}`}>{row.status}</span></td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            {row.status === "Pending" ? (
                              <button disabled={busy} onClick={() => void runUserAction(row.id, "verify")} className="rounded-md border border-emerald-400/40 px-2 py-1 text-xs text-emerald-200 disabled:opacity-60">Verify</button>
                            ) : row.status === "Suspended" ? (
                              <button disabled={busy} onClick={() => void runUserAction(row.id, "reactivate")} className="rounded-md border border-cyan-400/40 px-2 py-1 text-xs text-cyan-200 disabled:opacity-60">Reactivate</button>
                            ) : (
                              <button disabled={busy} onClick={() => void runUserAction(row.id, "suspend")} className="rounded-md border border-rose-400/40 px-2 py-1 text-xs text-rose-200 disabled:opacity-60">Suspend</button>
                            )}
                            <button disabled={busy} onClick={() => void runUserAction(row.id, "reject")} className="rounded-md border border-rose-500/40 px-2 py-1 text-xs text-rose-200 disabled:opacity-60">Reject</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : tab === "services" ? (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-black/25 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">Service</th>
                    <th className="px-3 py-2 font-medium">Provider</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((row) => (
                    <tr key={row.id} className="border-t border-white/10">
                      <td className="px-3 py-3">{row.name}</td>
                      <td className="px-3 py-3 text-slate-400">{row.provider}</td>
                      <td className="px-3 py-3">{row.category}</td>
                      <td className="px-3 py-3">
                        <Badge variant={row.is_active ? "secondary" : "outline"}>
                          {row.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-slate-400">{row.updated_at ? new Date(row.updated_at).toLocaleString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-black/25 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Actor</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Target</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows
                    .filter((r) => {
                      const q = query.trim().toLowerCase();
                      if (!q) return true;
                      return `${r.actor_email ?? ""} ${r.action} ${r.target_email ?? r.target_user_id ?? ""} ${r.reason ?? ""}`.toLowerCase().includes(q);
                    })
                    .map((row) => (
                      <tr key={row.id} className="border-t border-white/10">
                        <td className="px-3 py-3">{new Date(row.created_at).toLocaleString()}</td>
                        <td className="px-3 py-3 text-slate-300">{row.actor_email || "-"}</td>
                        <td className="px-3 py-3">{row.action}</td>
                        <td className="px-3 py-3 text-slate-400">{row.target_email || row.target_user_id || "-"}</td>
                        <td className="px-3 py-3"><span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(row.status)}`}>{row.status}</span></td>
                        <td className="px-3 py-3 text-slate-400">{row.reason || "-"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
