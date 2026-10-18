import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { invokeWithLiveToken, authFunctionFetch, extractFunctionErrorMessage } from "@/lib/live-token";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type AdminSummary = {
  total_users: number;
  total_token_balance: number;
  total_lifetime_tokens_used: number;
};

type AdminUserRow = {
  id: string;
  email: string | null;
  token_balance: number;
  lifetime_tokens_used: number;
  updated_at: string | null;
};

type AdminAuditRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  target_email: string | null;
  target_user_id: string | null;
  status: "attempt" | "success" | "failed" | "denied";
  before_value: number | null;
  after_value: number | null;
  delta_value: number | null;
  reason: string | null;
};

export default function TokenAdmin() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [mode, setMode] = useState<"set" | "add" | "deduct">("add");
  const [amount, setAmount] = useState("1000");
  const [note, setNote] = useState("Manual owner adjustment");
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (debouncedQuery) qs.set("search", debouncedQuery);
      qs.set("limit", "120");
      const url = `admin-token-console${qs.toString() ? `?${qs.toString()}` : ""}`;
      const response = await authFunctionFetch(url, "", { method: "GET" });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      const data = await response.json() as {
        success: boolean;
        summary: AdminSummary;
        users: AdminUserRow[];
        audit_logs: AdminAuditRow[];
      };
      if (!data?.success) throw new Error("Failed to load token admin data.");
      setSummary(data.summary);
      setUsers(data.users || []);
      setAuditLogs(data.audit_logs || []);
      if (!selectedUserId && data.users?.length) setSelectedUserId(data.users[0].id);
    } catch (err: unknown) {
      const message = await extractFunctionErrorMessage(err, "Failed to load token admin data");
      toast({ title: "Load failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, selectedUserId, toast]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) return;
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void fetchData();
    }, 350);
  }, [fetchData]);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchData();
  }, [fetchData, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel(`admin-tokens-live-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_profiles" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "token_transactions" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_audit_logs" }, scheduleRefresh)
      .subscribe();

    const pollTimer = window.setInterval(() => void fetchData(), 20000);

    return () => {
      window.clearInterval(pollTimer);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [fetchData, isAdmin, scheduleRefresh]);

  const selectedUser = useMemo(
    () => users.find((row) => row.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const applyAdjustment = async () => {
    if (!selectedUserId) {
      toast({ title: "Select a user", variant: "destructive" });
      return;
    }
    const numericAmount = Math.max(0, Math.floor(Number(amount || "0")));
    if (!Number.isFinite(numericAmount)) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await invokeWithLiveToken<{
        success: boolean;
        results: Array<{
          target_user_id: string;
          balance_before: number;
          balance_after: number;
        }>;
      }>("admin-token-override", {
        body: {
          confirm_override: "CONFIRM_OVERRIDE",
          overrides: [
            {
              target_user_id: selectedUserId,
              mode,
              amount: numericAmount,
              reason: note,
            },
          ],
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error("Token update failed.");
      const row = data.results?.[0];
      if (!row) throw new Error("Token update did not return any result.");

      toast({
        title: "Tokens updated",
        description: `Balance ${row.balance_before} -> ${row.balance_after}`,
      });
      await fetchData();
    } catch (err: unknown) {
      const message = await extractFunctionErrorMessage(err, "Failed to update tokens");
      toast({ title: "Update failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-10">
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Project owner access required.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-10 space-y-6">
        <h1 className="text-3xl font-bold">Token Control Center</h1>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardDescription>Total Users</CardDescription><CardTitle>{loading ? "-" : summary?.total_users ?? 0}</CardTitle></CardHeader>
          </Card>
          <Card>
            <CardHeader><CardDescription>Total Token Pool</CardDescription><CardTitle>{loading ? "-" : new Intl.NumberFormat("en-IN").format(summary?.total_token_balance ?? 0)}</CardTitle></CardHeader>
          </Card>
        <Card>
          <CardHeader><CardDescription>Lifetime Tokens Used</CardDescription><CardTitle>{loading ? "-" : new Intl.NumberFormat("en-IN").format(summary?.total_lifetime_tokens_used ?? 0)}</CardTitle></CardHeader>
        </Card>
      </div>

        <Card>
          <CardHeader>
            <CardTitle>Manage User Tokens</CardTitle>
            <CardDescription>Owner-only balance controls for support and moderation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Search users</Label>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="email or user id" />
              </div>
              <div>
                <Label>Select user</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger><SelectValue placeholder="Choose user" /></SelectTrigger>
                  <SelectContent>
                    {users.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {(row.email || row.id).slice(0, 70)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedUser && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p><span className="font-medium">Email:</span> {selectedUser.email || "N/A"}</p>
                <p><span className="font-medium">Current balance:</span> {new Intl.NumberFormat("en-IN").format(selectedUser.token_balance)}</p>
                <p><span className="font-medium">Lifetime used:</span> {new Intl.NumberFormat("en-IN").format(selectedUser.lifetime_tokens_used)}</p>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label>Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as "set" | "add" | "deduct")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add</SelectItem>
                    <SelectItem value="deduct">Deduct</SelectItem>
                    <SelectItem value="set">Set exact balance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Reason</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>

            <Button onClick={applyAdjustment} disabled={saving || loading}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Applying...</> : "Apply Token Update"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
            <CardDescription>Every admin token action is logged before and after execution.</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit records yet.</p>
            ) : (
              <div className="max-h-[380px] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="p-2 text-left font-medium">Time</th>
                      <th className="p-2 text-left font-medium">Actor</th>
                      <th className="p-2 text-left font-medium">Target</th>
                      <th className="p-2 text-left font-medium">Status</th>
                      <th className="p-2 text-left font-medium">Change</th>
                      <th className="p-2 text-left font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-2 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                        <td className="p-2">{row.actor_email || "-"}</td>
                        <td className="p-2">{row.target_email || row.target_user_id || "-"}</td>
                        <td className="p-2 uppercase text-xs tracking-wide">{row.status}</td>
                        <td className="p-2">{row.before_value ?? 0} {"->"} {row.after_value ?? 0}</td>
                        <td className="p-2">{row.reason || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
