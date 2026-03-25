import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_ENABLED } from "@/lib/token-usage";
import { extractFunctionErrorMessage, invokeWithLiveToken } from "@/lib/live-token";
import { useTokenUsage } from "@/hooks/useTokenUsage";

type TopUpRecord = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  account_user_id: string;
  tokens_added: number;
  amount_paid: number;
  currency: string;
  package_selected: string;
  notes: string | null;
  billing_address: string | null;
  gst_id: string | null;
  status: "pending" | "completed" | "failed";
  payment_method: string;
  created_at: string;
};

type UsageRecord = {
  id: string;
  amount: number;
  description: string;
  endpoint: string | null;
  created_at: string;
};

const PACKAGES = [
  { id: "starter", label: "5,000 tokens - Rs 199", pack: "starter", amount: 199, tokens: 5000 },
  { id: "growth", label: "15,000 tokens - Rs 499", pack: "growth", amount: 499, tokens: 15000 },
  { id: "pro", label: "50,000 tokens - Rs 1499", pack: "pro", amount: 1499, tokens: 50000 },
  { id: "custom", label: "Custom amount", pack: "custom", amount: 0, tokens: 0 },
] as const;

function csv(rows: Array<Record<string, string | number>>) {
  if (!rows.length) return "";
  const heads = Object.keys(rows[0]);
  const lines = [heads.join(",")];
  rows.forEach((r) => lines.push(heads.map((h) => `"${String(r[h] ?? "").replaceAll("\"", "\"\"")}"`).join(",")));
  return lines.join("\n");
}

export default function QosSettings() {
  const { toast } = useToast();
  const location = useLocation();
  const { tokenUsage, refreshTokenUsage, balanceRecentlyUpdated, balanceUpdatedAt } = useTokenUsage();

  const [tab, setTab] = useState<"account" | "monitoring" | "billing">("account");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");

  const [interval, setIntervalValue] = useState("5m");
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [rtThreshold, setRtThreshold] = useState("500");
  const [uptimeThreshold, setUptimeThreshold] = useState("99");
  const [errorThreshold, setErrorThreshold] = useState("2");
  const [tokenThreshold, setTokenThreshold] = useState("500");

  const [topupOpen, setTopupOpen] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<"starter" | "growth" | "pro" | "custom">("growth");
  const [customTokens, setCustomTokens] = useState("");
  const [amountPaid, setAmountPaid] = useState("499");
  const [notes, setNotes] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [gstId, setGstId] = useState("");

  const [records, setRecords] = useState<TopUpRecord[]>([]);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [filter, setFilter] = useState<"all" | "topups" | "usage">("all");
  const [detail, setDetail] = useState<TopUpRecord | null>(null);

  useEffect(() => {
    if (location.pathname.includes("/settings/billing") || location.pathname.includes("/profile/payments")) {
      setTab("billing");
    }
    if (new URLSearchParams(location.search).get("topup") === "1") {
      setTab("billing");
      setTopupOpen(true);
    }
  }, [location.pathname, location.search]);

  const loadBilling = async (uid: string) => {
    const db = supabase as any;
    const [topups, debits] = await Promise.all([
      db.from("topup_records").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
      db
        .from("token_transactions")
        .select("id, amount, description, endpoint, created_at")
        .eq("user_id", uid)
        .eq("type", "debit")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (!topups.error) setRecords((topups.data || []) as TopUpRecord[]);
    if (!debits.error) setUsage((debits.data || []) as UsageRecord[]);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setEmail(user.email ?? "");
        const { data: profile } = await supabase.from("profiles").select("name, organization").eq("id", user.id).maybeSingle();
        setName(profile?.name ?? "");
        setOrganization(profile?.organization ?? "");
        setFullName(profile?.name ?? "");
        await loadBilling(user.id);
      }
      setLoading(false);
    };
    void init();
  }, []);

  const selected = useMemo(() => PACKAGES.find((p) => p.id === selectedPackage) ?? PACKAGES[1], [selectedPackage]);
  const tokensToAdd = selectedPackage === "custom" ? Number(customTokens || 0) : selected.tokens;
  const amount = Number(amountPaid || 0);

  const merged = useMemo(() => {
    const t = records.map((r) => ({
      id: `topup-${r.id}`,
      date: r.created_at,
      type: "Top-Up",
      tokens: `+${new Intl.NumberFormat("en-IN").format(r.tokens_added)}`,
      amount: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(r.amount_paid),
      status: r.status,
      details: r.package_selected,
      category: "topups" as const,
      raw: r,
    }));
    const u = usage.map((r) => ({
      id: `usage-${r.id}`,
      date: r.created_at,
      type: "QoS Test",
      tokens: `-${new Intl.NumberFormat("en-IN").format(r.amount)}`,
      amount: "-",
      status: "used",
      details: r.description || r.endpoint || "Usage",
      category: "usage" as const,
      raw: null,
    }));
    return [...t, ...u].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [records, usage]);

  const rows = merged.filter((r) => filter === "all" || r.category === filter);

  const submitTopup = async () => {
    if (!fullName || !email || !userId || amount <= 0 || tokensToAdd <= 0) {
      toast({ title: "Missing details", description: "Fill all required fields.", variant: "destructive" });
      return;
    }

    setTopupLoading(true);
    const db = supabase as any;
    let id: string | null = null;
    try {
      const created = await db
        .from("topup_records")
        .insert({
          user_id: userId,
          full_name: fullName,
          email,
          account_user_id: userId,
          tokens_added: tokensToAdd,
          amount_paid: amount,
          currency: "INR",
          package_selected: selected.label,
          notes: notes || null,
          billing_address: billingAddress || null,
          gst_id: gstId || null,
          status: "pending",
          payment_method: PAYMENT_ENABLED ? "gateway" : "manual",
        })
        .select("id")
        .single();

      if (created.error) throw created.error;
      id = created.data?.id ?? null;

      const payload = selected.pack === "custom" ? { pack: "custom", customAmount: amount } : { pack: selected.pack };
      const { data, error } = await invokeWithLiveToken("payments-create-order", { body: payload });
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error?: string }).error);

      if (id) await db.from("topup_records").update({ status: "completed" }).eq("id", id);
      await refreshTokenUsage();
      await loadBilling(userId);
      setTopupOpen(false);
      toast({
        title: "Top-up successful",
        description: `${new Intl.NumberFormat("en-IN").format(tokensToAdd)} tokens added to your account`,
      });
    } catch (err: unknown) {
      if (id) await db.from("topup_records").update({ status: "failed" }).eq("id", id);
      await loadBilling(userId);
      const message = await extractFunctionErrorMessage(err, "Top-up failed");
      toast({ title: "Top-up failed", description: message, variant: "destructive" });
    } finally {
      setTopupLoading(false);
    }
  };

  const exportCSV = () => {
    const content = csv(
      rows.map((r) => ({
        date: new Date(r.date).toLocaleString(),
        type: r.type,
        tokens: r.tokens,
        amount: r.amount,
        status: String(r.status),
        details: r.details,
      })),
    );
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "billing-transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-8 text-sm text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8 space-y-6">
        <h1 className="text-3xl font-bold">QoS Settings</h1>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "account" | "monitoring" | "billing")} className="space-y-6">
          <TabsList>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="billing">Billing & Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <Card>
              <CardHeader><CardTitle>Account</CardTitle><CardDescription>Basic profile settings</CardDescription></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><Label>Email</Label><Input value={email} disabled /></div>
                <div><Label>Organization</Label><Input value={organization} onChange={(e) => setOrganization(e.target.value)} /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring">
            <Card>
              <CardHeader><CardTitle>QoS Monitoring</CardTitle><CardDescription>Alert thresholds and channels</CardDescription></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div><Label>Interval</Label><Select value={interval} onValueChange={setIntervalValue}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1m">1m</SelectItem><SelectItem value="5m">5m</SelectItem><SelectItem value="15m">15m</SelectItem></SelectContent></Select></div>
                <div className="flex items-center gap-3 pt-6"><Switch checked={notifyInApp} onCheckedChange={setNotifyInApp} /><Label>In-app alerts</Label></div>
                <div className="flex items-center gap-3"><Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} /><Label>Email alerts (stub)</Label></div>
                <div><Label>Response time threshold (ms)</Label><Input value={rtThreshold} onChange={(e) => setRtThreshold(e.target.value)} /></div>
                <div><Label>Uptime threshold (%)</Label><Input value={uptimeThreshold} onChange={(e) => setUptimeThreshold(e.target.value)} /></div>
                <div><Label>Error rate threshold (%)</Label><Input value={errorThreshold} onChange={(e) => setErrorThreshold(e.target.value)} /></div>
                <div><Label>Low token threshold</Label><Input value={tokenThreshold} onChange={(e) => setTokenThreshold(e.target.value)} /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <CardTitle>Billing & Payments</CardTitle>
                    <CardDescription>Visible for all users. Includes stub mode.</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{PAYMENT_ENABLED ? "Live Mode" : "Test Mode"}</Badge>
                    <Button onClick={() => setTopupOpen(true)}>+ Top Up</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`rounded-lg border p-3 transition-colors ${balanceRecentlyUpdated ? "border-emerald-500 bg-emerald-50/60" : ""}`}>
                  <p className="font-medium">Current Balance</p>
                  <p className="text-2xl font-semibold">{new Intl.NumberFormat("en-IN").format(tokenUsage.balance)}</p>
                  <p className="text-xs text-muted-foreground">{balanceUpdatedAt ? `Updated ${new Date(balanceUpdatedAt).toLocaleTimeString()}` : "Waiting for sync"}</p>
                  {tokenUsage.stale && <p className="text-xs text-amber-600">May be outdated</p>}
                </div>

                <div className="flex items-end gap-3">
                  <div><Label>Filter</Label><Select value={filter} onValueChange={(v) => setFilter(v as "all" | "topups" | "usage")}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="topups">Top-Ups</SelectItem><SelectItem value="usage">Usage</SelectItem></SelectContent></Select></div>
                  <Button variant="outline" onClick={exportCSV}>Export CSV</Button>
                </div>

                {rows.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <p className="font-medium">No transactions yet</p>
                    <p className="text-sm text-muted-foreground">Your payment and usage history will appear here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Tokens</th><th className="p-3 text-left">Amount</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Details</th><th className="p-3 text-left">View</th></tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id} className="border-t">
                            <td className="p-3">{new Date(r.date).toLocaleDateString()}</td>
                            <td className="p-3">{r.type}</td>
                            <td className="p-3">{r.tokens}</td>
                            <td className="p-3">{r.amount}</td>
                            <td className="p-3"><Badge variant={r.status === "completed" || r.status === "used" ? "secondary" : r.status === "failed" ? "destructive" : "outline"}>{String(r.status)}</Badge></td>
                            <td className="p-3">{r.details}</td>
                            <td className="p-3">{r.raw ? <Button size="sm" variant="outline" onClick={() => setDetail(r.raw as TopUpRecord)}>View</Button> : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Tokens - Top Up</DialogTitle>
            <DialogDescription>Capture billing details and process top-up in test/live mode.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Full Name *</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div><Label>Account / User ID</Label><Input value={userId} readOnly /></div>
              <div><Label>Email Address *</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Top-Up Amount *</Label><Input value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} /></div>
            </div>

            <div>
              <Label>Token Package</Label>
              <RadioGroup value={selectedPackage} onValueChange={(v) => setSelectedPackage(v as "starter" | "growth" | "pro" | "custom")} className="mt-2">
                {PACKAGES.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <RadioGroupItem value={p.id} id={`p-${p.id}`} />
                    <Label htmlFor={`p-${p.id}`}>{p.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {selectedPackage === "custom" && <div><Label>Custom tokens</Label><Input value={customTokens} onChange={(e) => setCustomTokens(e.target.value)} /></div>}

            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Purpose / Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <div><Label>Billing Address</Label><Input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} /></div>
              <div className="md:col-span-2"><Label>GST / Tax ID</Label><Input value={gstId} onChange={(e) => setGstId(e.target.value)} /></div>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p>Tokens to add: <span className="font-semibold">{new Intl.NumberFormat("en-IN").format(tokensToAdd)}</span></p>
              <p>Amount: <span className="font-semibold">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount)}</span></p>
              <p>New balance after: <span className="font-semibold">{new Intl.NumberFormat("en-IN").format(tokenUsage.balance + tokensToAdd)} tokens</span></p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTopupOpen(false)} disabled={topupLoading}>Cancel</Button>
              <Button onClick={submitTopup} disabled={topupLoading}>{topupLoading ? "Processing..." : "Confirm Top-Up"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detail)} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Top-Up Details</DialogTitle></DialogHeader>
          {detail && (
            <div className="text-sm space-y-1">
              <p><span className="font-medium">Name:</span> {detail.full_name}</p>
              <p><span className="font-medium">Email:</span> {detail.email}</p>
              <p><span className="font-medium">Package:</span> {detail.package_selected}</p>
              <p><span className="font-medium">Tokens:</span> {new Intl.NumberFormat("en-IN").format(detail.tokens_added)}</p>
              <p><span className="font-medium">Amount:</span> {new Intl.NumberFormat("en-IN", { style: "currency", currency: detail.currency || "INR", maximumFractionDigits: 0 }).format(detail.amount_paid)}</p>
              <p><span className="font-medium">Status:</span> {detail.status}</p>
              <p><span className="font-medium">Notes:</span> {detail.notes || "-"}</p>
              <p><span className="font-medium">Address:</span> {detail.billing_address || "-"}</p>
              <p><span className="font-medium">GST ID:</span> {detail.gst_id || "-"}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

