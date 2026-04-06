import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertTriangle,
  ArrowUpRight,
  Coins,
  Crown,
  KeyRound,
  ReceiptText,
  Settings2,
  Shield,
  UserCircle2,
  Users,
} from "lucide-react";

const adminScope = [
  "Global dashboard - all users, all services, platform-wide metrics",
  "User management - create, suspend, delete, and role updates",
  "Token override - grant or revoke any user's balance",
  "Billing control - refunds, invoices, and plan overrides",
  "Audit logs - full action trail across all accounts",
  "System config - token costs, rate limits, and alerts",
  "API key governance - rotate platform keys and emergency revoke",
];

const userScope = [
  "Personal dashboard - only their registered services",
  "Token balance - view and top up only their own account",
  "Own billing - invoices and personal plan updates",
  "Personal alerts - thresholds for their own services only",
  "Own API keys - create and rotate keys for self",
  "No access to other users, audit logs, or global config",
];

const userRows = [
  { name: "Arjun Sharma", email: "arjun@mit.edu", plan: "Student", tokens: "4,210", status: "Active", actionA: "Edit", actionB: "Suspend" },
  { name: "Priya Mehta", email: "priya@gmail.com", plan: "Free", tokens: "320", status: "Active", actionA: "Edit", actionB: "Suspend" },
  { name: "Rahul Kumar", email: "rahul@dev.io", plan: "Pro", tokens: "18,400", status: "Pending", actionA: "Verify", actionB: "Reject" },
  { name: "Sneha Tiwari", email: "sneha@pune.ac.in", plan: "Student", tokens: "49", status: "Low tokens", actionA: "+ Tokens", actionB: "Edit" },
];

function statusClass(status: string) {
  if (status === "Active") return "bg-emerald-500/15 text-emerald-200 border-emerald-400/30";
  if (status === "Pending") return "bg-amber-500/15 text-amber-200 border-amber-400/30";
  return "bg-rose-500/15 text-rose-200 border-rose-400/30";
}

export default function AdminHub() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-10">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Admin access required.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070a] text-slate-100">
      <Header />
      <div className="container py-8 space-y-8">
        <div className="rounded-3xl border border-violet-300/30 bg-gradient-to-r from-[#2f2a56] via-[#463f7f] to-[#6e63b6] p-8 shadow-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-white/20 text-white hover:bg-white/20">
              <Crown className="mr-1.5 h-3.5 w-3.5" />
              PerfSense Admin Console
            </Badge>
            <Badge variant="outline" className="border-violet-200/50 text-violet-50">
              v1.0.0 sandbox
            </Badge>
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">Admin vs User Authority Dashboard</h1>
          <p className="mt-2 max-w-3xl text-violet-50/90">
            Dedicated control plane for project owners with explicit separation from standard user experience.
          </p>
        </div>

        <section className="grid gap-5 lg:grid-cols-2">
          <Card className="border-violet-300/30 bg-[#12121a]">
            <CardHeader>
              <CardTitle className="text-violet-100 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Super Admin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {adminScope.map((line) => (
                <div key={line} className="flex items-start gap-2 text-slate-200">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-400" />
                  <span>{line}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-cyan-300/30 bg-[#12121a]">
            <CardHeader>
              <CardTitle className="text-cyan-100 flex items-center gap-2">
                <UserCircle2 className="h-5 w-5" />
                Standard User
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {userScope.map((line) => (
                <div key={line} className="flex items-start gap-2 text-slate-200">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  <span>{line}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="rounded-3xl border border-violet-200/20 bg-[#0f1016] p-4 shadow-xl lg:p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            {["Overview", "Users", "Billing", "System config"].map((tab, index) => (
              <button
                key={tab}
                type="button"
                className={`rounded-xl border px-4 py-2 text-sm ${index === 1 ? "border-violet-300 bg-violet-200 text-slate-900" : "border-white/20 bg-white/5 text-white"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <aside className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="mb-3 text-xs tracking-[0.18em] text-slate-400">PLATFORM</p>
              <div className="space-y-1 text-sm">
                <div className="rounded-lg px-3 py-2 text-slate-300">Overview</div>
                <div className="rounded-lg bg-violet-200 px-3 py-2 text-slate-900">Users</div>
                <div className="rounded-lg px-3 py-2 text-slate-300">Billing</div>
              </div>
              <p className="mb-3 mt-5 text-xs tracking-[0.18em] text-slate-400">CONFIG</p>
              <div className="space-y-1 text-sm">
                <div className="rounded-lg px-3 py-2 text-slate-300">System config</div>
                <div className="rounded-lg px-3 py-2 text-slate-300">Audit logs</div>
                <div className="rounded-lg px-3 py-2 text-slate-300">Global alerts</div>
              </div>
              <p className="mb-3 mt-5 text-xs tracking-[0.18em] text-slate-400">TOOLS</p>
              <div className="space-y-1 text-sm">
                <div className="rounded-lg px-3 py-2 text-slate-300">Token override</div>
                <div className="rounded-lg px-3 py-2 text-slate-300">API keys</div>
              </div>
            </aside>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex flex-wrap gap-3">
                <div className="flex-1 rounded-xl border border-white/15 bg-black/10 px-4 py-2 text-sm text-slate-300">
                  Search users by name, email, plan...
                </div>
                <div className="rounded-xl border border-white/15 bg-black/10 px-4 py-2 text-sm text-slate-300">All plans</div>
                <Button className="bg-violet-500 hover:bg-violet-400">+ Add user</Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-black/20 text-slate-300">
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
                    {userRows.map((row) => (
                      <tr key={row.email} className="border-t border-white/10">
                        <td className="px-3 py-3">{row.name}</td>
                        <td className="px-3 py-3 text-slate-400">{row.email}</td>
                        <td className="px-3 py-3">
                          <span className="rounded-full border border-violet-300/40 bg-violet-300/20 px-2 py-0.5 text-xs text-violet-100">{row.plan}</span>
                        </td>
                        <td className="px-3 py-3">{row.tokens}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass(row.status)}`}>{row.status}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            <button className="rounded-md border border-white/20 px-2 py-1 text-xs">{row.actionA}</button>
                            <button className={`rounded-md border px-2 py-1 text-xs ${row.actionB === "Suspend" || row.actionB === "Reject" ? "border-rose-400/40 text-rose-200" : "border-white/20"}`}>
                              {row.actionB}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-violet-300/20 bg-[#0f1016] p-6">
          <h2 className="text-lg font-semibold text-violet-100">Admin System Prompt</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-300">
            <p>You are PerfSense Admin AI with full read/write platform access for users, tokens, billing, services, and audit data.</p>
            <p>Require <code>CONFIRM_OVERRIDE</code> before any token cost, rate limit, or threshold update.</p>
            <p>Destructive actions must write to audit log before execution and include actor, timestamp, target, and reason.</p>
            <p>Bulk updates for 50+ users require additional explicit confirmation and must be flagged as high-risk.</p>
            <p>Switching payment mode from sandbox to live requires phrase <code>CONFIRM_LIVE_MODE</code>.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button className="bg-violet-500 hover:bg-violet-400"><Shield className="mr-1.5 h-4 w-4" />Generate RBAC middleware <ArrowUpRight className="ml-1 h-4 w-4" /></Button>
            <Button variant="outline" className="border-violet-300/40 text-violet-100"><ReceiptText className="mr-1.5 h-4 w-4" />Audit log schema <ArrowUpRight className="ml-1 h-4 w-4" /></Button>
            <Button variant="outline" className="border-violet-300/40 text-violet-100"><Coins className="mr-1.5 h-4 w-4" />Token override API <ArrowUpRight className="ml-1 h-4 w-4" /></Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="py-5">
              <p className="text-xs text-slate-400">Platform users</p>
              <p className="mt-1 text-2xl font-semibold">2,431</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5">
            <CardContent className="py-5">
              <p className="text-xs text-slate-400">MRR</p>
              <p className="mt-1 text-2xl font-semibold">₹4.7L</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5">
            <CardContent className="py-5">
              <p className="text-xs text-slate-400">Global alerts</p>
              <p className="mt-1 text-2xl font-semibold">17</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5">
            <CardContent className="py-5">
              <p className="text-xs text-slate-400">Risk</p>
              <p className="mt-1 flex items-center gap-1.5 text-rose-200"><AlertTriangle className="h-4 w-4" /> 3 high</p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-violet-300/25 bg-violet-500/10">
            <CardContent className="py-5">
              <p className="text-sm text-violet-100">Users management</p>
              <p className="mt-2 text-xs text-slate-300">Create, suspend, and verify accounts across plans.</p>
              <Button variant="link" className="px-0 text-violet-100"><Users className="mr-1 h-4 w-4" />Open Users</Button>
            </CardContent>
          </Card>
          <Card className="border-violet-300/25 bg-violet-500/10">
            <CardContent className="py-5">
              <p className="text-sm text-violet-100">Token overrides</p>
              <p className="mt-2 text-xs text-slate-300">Grant/revoke tokens with full audit visibility.</p>
              <Button variant="link" className="px-0 text-violet-100"><Coins className="mr-1 h-4 w-4" />Open Token Console</Button>
            </CardContent>
          </Card>
          <Card className="border-violet-300/25 bg-violet-500/10">
            <CardContent className="py-5">
              <p className="text-sm text-violet-100">System config</p>
              <p className="mt-2 text-xs text-slate-300">Rate limits, costs, and platform alert thresholds.</p>
              <Button variant="link" className="px-0 text-violet-100"><Settings2 className="mr-1 h-4 w-4" />Open Config</Button>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 p-5">
          <h3 className="flex items-center gap-2 text-base font-semibold text-cyan-100">
            <KeyRound className="h-4 w-4" />
            User UI Contract
          </h3>
          <p className="mt-2 text-sm text-cyan-50/90">
            Standard users see only personal services, personal billing, and personal token actions. No global user, config, or audit controls are exposed in user routes.
          </p>
        </section>
      </div>
    </div>
  );
}
