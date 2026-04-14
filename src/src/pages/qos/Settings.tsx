import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

type PaymentRecord = {
  id: string;
  amount_in_paise: number;
  tokens_purchased: number;
  status: "pending" | "success" | "failed";
  pack_name: string | null;
  created_at: string;
};

type OnboardingPlanId = "free" | "student" | "basic" | "pro";

type OnboardingPlan = {
  id: OnboardingPlanId;
  title: string;
  subtitle: string;
  amountInrMonthly: number;
  tokens: number;
  isStudentOnly?: boolean;
};

const ONBOARDING_PLANS: OnboardingPlan[] = [
  { id: "free", title: "Free", subtitle: "Starter access", amountInrMonthly: 0, tokens: 500 },
  { id: "student", title: "Student", subtitle: "College pricing", amountInrMonthly: 99, tokens: 5000, isStudentOnly: true },
  { id: "basic", title: "Basic", subtitle: "Solo projects", amountInrMonthly: 299, tokens: 15000 },
  { id: "pro", title: "Pro", subtitle: "Production workloads", amountInrMonthly: 999, tokens: 50000 },
];

const WORK_EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

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
  const navigate = useNavigate();
  const { tokenUsage, refreshTokenUsage, applyOptimisticBalance, rollbackBalance, balanceRecentlyUpdated, balanceUpdatedAt, liveStatus } = useTokenUsage();

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
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedPlan, setSelectedPlan] = useState<OnboardingPlanId>("free");
  const [accountForm, setAccountForm] = useState({
    firstName: "",
    lastName: "",
    workEmail: "",
    orgName: "",
    country: "",
    role: "",
    useCase: "",
    acceptedTerms: false,
    studentConfirmed: false,
  });
  const [accountErrors, setAccountErrors] = useState<Record<string, string>>({});
  const [paymentForm, setPaymentForm] = useState({
    cardNumber: "",
    expiry: "",
    cvv: "",
    cardName: "",
    billingAddress: "",
    gstId: "",
  });
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});
  const [onboardingResult, setOnboardingResult] = useState<{
    paymentRef: string;
    tokensAdded: number;
    planName: string;
  } | null>(null);

  const [records, setRecords] = useState<TopUpRecord[]>([]);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
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
    const [topups, debits, paymentsRes] = await Promise.all([
      db.from("topup_records").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(50),
      db
        .from("token_transactions")
        .select("id, amount, description, endpoint, created_at")
        .eq("user_id", uid)
        .eq("type", "debit")
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("payments")
        .select("id, amount_in_paise, tokens_purchased, status, pack_name, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (!topups.error) setRecords((topups.data || []) as TopUpRecord[]);
    if (!debits.error) setUsage((debits.data || []) as UsageRecord[]);
    if (!paymentsRes.error) setPayments((paymentsRes.data || []) as PaymentRecord[]);
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
        await loadBilling(user.id);
      }
      setLoading(false);
    };
    void init();
  }, []);

  useEffect(() => {
    if (!userId) return;

    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void loadBilling(userId);
      }, 250);
    };

    const channel = supabase
      .channel(`billing-live-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_profiles", filter: `id=eq.${userId}` },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "topup_records", filter: `user_id=eq.${userId}` },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "token_transactions", filter: `user_id=eq.${userId}` },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `user_id=eq.${userId}` },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !balanceUpdatedAt) return;
    void loadBilling(userId);
  }, [balanceUpdatedAt, userId]);

  useEffect(() => {
    if (!userId) return;
    const hasPending = records.some((row) => row.status === "pending") || payments.some((row) => row.status === "pending");
    if (!hasPending) return;
    const poller = window.setInterval(() => {
      void loadBilling(userId);
    }, 5000);
    return () => window.clearInterval(poller);
  }, [records, payments, userId]);

  const selectedPlanConfig = useMemo(
    () => ONBOARDING_PLANS.find((plan) => plan.id === selectedPlan) ?? ONBOARDING_PLANS[0],
    [selectedPlan],
  );

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
    const p = payments.map((r) => ({
      id: `payment-${r.id}`,
      date: r.created_at,
      type: "Payment",
      tokens: `+${new Intl.NumberFormat("en-IN").format(r.tokens_purchased || 0)}`,
      amount: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
        (r.amount_in_paise || 0) / 100,
      ),
      status: r.status === "success" ? "completed" : r.status,
      details: r.pack_name || "payment",
      category: "topups" as const,
      raw: null,
    }));
    return [...t, ...u, ...p].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [records, usage, payments]);

  const rows = merged.filter((r) => filter === "all" || r.category === filter);

  useEffect(() => {
    if (!topupOpen) return;
    const [firstName = "", ...rest] = (name || "").trim().split(/\s+/);
    const lastName = rest.join(" ");
    setOnboardingStep(1);
    setSelectedPlan("free");
    setOnboardingResult(null);
    setAccountErrors({});
    setPaymentErrors({});
    setAccountForm((prev) => ({
      ...prev,
      firstName: firstName || prev.firstName,
      lastName: lastName || prev.lastName,
      workEmail: email || prev.workEmail,
      orgName: organization || prev.orgName,
      acceptedTerms: false,
      studentConfirmed: false,
    }));
    setPaymentForm({
      cardNumber: "",
      expiry: "",
      cvv: "",
      cardName: "",
      billingAddress: "",
      gstId: "",
    });
  }, [topupOpen, name, email, organization]);

  const validateStep1 = () => {
    const errors: Record<string, string> = {};
    if (!accountForm.firstName.trim()) errors.firstName = "First name is required.";
    if (!accountForm.lastName.trim()) errors.lastName = "Last name is required.";
    if (!WORK_EMAIL_REGEX.test(accountForm.workEmail.trim())) errors.workEmail = "Enter a valid work email.";
    if (!accountForm.orgName.trim()) errors.orgName = "Organisation/college is required.";
    if (!accountForm.country.trim()) errors.country = "Country is required.";
    if (!accountForm.role.trim()) errors.role = "Role is required.";
    if (!accountForm.acceptedTerms) errors.acceptedTerms = "You must accept Terms & Privacy.";
    setAccountErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePaymentStep = () => {
    const errors: Record<string, string> = {};
    const cardDigits = paymentForm.cardNumber.replace(/\D/g, "");
    const cvvDigits = paymentForm.cvv.replace(/\D/g, "");
    const expiryDigits = paymentForm.expiry.replace(/\D/g, "");
    const month = Number(expiryDigits.slice(0, 2));
    if (cardDigits.length !== 16) errors.cardNumber = "Card number must be 16 digits.";
    if (!paymentForm.cardName.trim()) errors.cardName = "Card holder name is required.";
    if (expiryDigits.length !== 4 || month < 1 || month > 12) errors.expiry = "Use MM/YY format.";
    if (cvvDigits.length !== 3) errors.cvv = "CVV must be 3 digits.";
    if (!paymentForm.billingAddress.trim()) errors.billingAddress = "Billing address is required.";
    setPaymentErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const toCardNumber = (value: string) =>
    value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

  const toExpiry = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  const toCvv = (value: string) => value.replace(/\D/g, "").slice(0, 3);

  const buildPaymentReference = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const token = Array.from({ length: 6 })
      .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
      .join("");
    return `PS-${token}`;
  };

  const handleStep1Next = () => {
    if (!validateStep1()) return;
    setOnboardingStep(2);
  };

  const handleStep2Next = () => {
    if (selectedPlanConfig.id === "free") {
      void claimFreePlan();
      return;
    }
    setOnboardingStep(3);
  };

  const claimFreePlan = async () => {
    setTopupLoading(true);
    try {
      const { data, error } = await invokeWithLiveToken<{
        success?: boolean;
        error?: string;
        next_eligible_at?: string;
        tokens_granted?: number;
        new_balance?: number;
      }>("claim-free-monthly", { body: {} });
      if (error) throw error;
      if (!data?.success) {
        if (data?.error === "already_claimed") {
          const nextDate = data?.next_eligible_at ? new Date(data.next_eligible_at).toLocaleDateString() : "next month";
          throw new Error(`Free monthly plan already claimed. Next claim: ${nextDate}`);
        }
        throw new Error(data?.error || "Unable to activate free plan.");
      }
      if (typeof data.new_balance === "number") applyOptimisticBalance(data.new_balance);
      await refreshTokenUsage();
      if (userId) await loadBilling(userId);
      setOnboardingResult({
        paymentRef: buildPaymentReference(),
        tokensAdded: Number(data.tokens_granted ?? 0),
        planName: selectedPlanConfig.title,
      });
      setOnboardingStep(4);
    } catch (err: unknown) {
      const message = await extractFunctionErrorMessage(err, "Unable to activate free plan");
      toast({ title: "Free plan activation failed", description: message, variant: "destructive" });
    } finally {
      setTopupLoading(false);
    }
  };

  const completePaidOnboarding = async () => {
    if (!userId) {
      toast({ title: "Authentication required", description: "Please sign in again.", variant: "destructive" });
      return;
    }
    if (!validatePaymentStep()) return;

    setTopupLoading(true);
    const previousBalance = tokenUsage.balance;
    const tokensToAdd = selectedPlanConfig.tokens;
    applyOptimisticBalance(previousBalance + tokensToAdd);

    try {
      const payload = {
        tokensAdded: tokensToAdd,
        amountPaid: selectedPlanConfig.amountInrMonthly,
        packageSelected: selectedPlanConfig.title,
        fullName: `${accountForm.firstName} ${accountForm.lastName}`.trim(),
        email: accountForm.workEmail.trim(),
        notes: accountForm.useCase || null,
        billingAddress: paymentForm.billingAddress.trim(),
        gstId: paymentForm.gstId.trim() || null,
      };

      const { data, error } = await invokeWithLiveToken("token-topup", { body: payload });
      if (error) throw error;
      if ((data as { error?: string } | null)?.error) throw new Error((data as { error?: string }).error);

      if (typeof (data as { newBalance?: number } | null)?.newBalance === "number") {
        applyOptimisticBalance((data as { newBalance: number }).newBalance);
      }

      await refreshTokenUsage();
      await loadBilling(userId);
      setOnboardingResult({
        paymentRef: buildPaymentReference(),
        tokensAdded: tokensToAdd,
        planName: selectedPlanConfig.title,
      });
      setOnboardingStep(4);
    } catch (err: unknown) {
      rollbackBalance(previousBalance);
      await loadBilling(userId);
      const message = await extractFunctionErrorMessage(err, "Top-up failed");
      toast({ title: "Payment failed", description: message, variant: "destructive" });
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
                  <p className="text-xs mt-1">
                    {liveStatus === "live" ? "Live" : liveStatus === "reconnecting" ? "Reconnecting..." : "Live updates paused (polling fallback)"}
                  </p>
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
            <DialogTitle>Subscription Onboarding</DialogTitle>
            <DialogDescription>Step {onboardingStep} of 4</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {onboardingStep === 1 && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>First name *</Label>
                    <Input
                      value={accountForm.firstName}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    />
                    {accountErrors.firstName && <p className="text-xs text-destructive mt-1">{accountErrors.firstName}</p>}
                  </div>
                  <div>
                    <Label>Last name *</Label>
                    <Input
                      value={accountForm.lastName}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    />
                    {accountErrors.lastName && <p className="text-xs text-destructive mt-1">{accountErrors.lastName}</p>}
                  </div>
                  <div>
                    <Label>Work email *</Label>
                    <Input
                      value={accountForm.workEmail}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, workEmail: e.target.value }))}
                    />
                    {accountErrors.workEmail && <p className="text-xs text-destructive mt-1">{accountErrors.workEmail}</p>}
                  </div>
                  <div>
                    <Label>Organisation / College *</Label>
                    <Input
                      value={accountForm.orgName}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, orgName: e.target.value }))}
                    />
                    {accountErrors.orgName && <p className="text-xs text-destructive mt-1">{accountErrors.orgName}</p>}
                  </div>
                  <div>
                    <Label>Country *</Label>
                    <Input
                      value={accountForm.country}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, country: e.target.value }))}
                    />
                    {accountErrors.country && <p className="text-xs text-destructive mt-1">{accountErrors.country}</p>}
                  </div>
                  <div>
                    <Label>Role *</Label>
                    <Input
                      value={accountForm.role}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, role: e.target.value }))}
                    />
                    {accountErrors.role && <p className="text-xs text-destructive mt-1">{accountErrors.role}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label>Use case (optional)</Label>
                    <Input
                      value={accountForm.useCase}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, useCase: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={accountForm.acceptedTerms}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, acceptedTerms: e.target.checked }))}
                    />
                    I accept Terms of Service and Privacy Policy.
                  </label>
                  {accountErrors.acceptedTerms && <p className="text-xs text-destructive">{accountErrors.acceptedTerms}</p>}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={accountForm.studentConfirmed}
                      onChange={(e) => setAccountForm((prev) => ({ ...prev, studentConfirmed: e.target.checked }))}
                    />
                    I confirm I am eligible for student pricing.
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setTopupOpen(false)}>Cancel</Button>
                  <Button onClick={handleStep1Next}>Continue</Button>
                </div>
              </div>
            )}

            {onboardingStep === 2 && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                  {ONBOARDING_PLANS.map((plan) => {
                    const disabled = plan.isStudentOnly && !accountForm.studentConfirmed;
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedPlan(plan.id)}
                        className={`text-left rounded-lg border p-4 transition ${
                          selectedPlan === plan.id ? "border-primary ring-2 ring-primary/30" : "border-border"
                        } ${disabled ? "opacity-40 cursor-not-allowed" : "hover:border-primary/60"}`}
                      >
                        <p className="font-semibold">{plan.title}</p>
                        <p className="text-sm text-muted-foreground">{plan.subtitle}</p>
                        <p className="mt-2 text-sm">
                          {plan.amountInrMonthly === 0 ? "Free" : `Rs ${plan.amountInrMonthly}/month`}
                        </p>
                        <p className="text-sm text-muted-foreground">{new Intl.NumberFormat("en-IN").format(plan.tokens)} tokens</p>
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <p className="font-medium">Selected: {selectedPlanConfig.title}</p>
                  <p>
                    {selectedPlanConfig.amountInrMonthly === 0 ? "No tokens required" : `Demo billing: Rs ${selectedPlanConfig.amountInrMonthly}/month`}
                  </p>
                  <p>Tokens: {new Intl.NumberFormat("en-IN").format(selectedPlanConfig.tokens)}</p>
                </div>
                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setOnboardingStep(1)}>Back</Button>
                  <Button onClick={handleStep2Next} disabled={topupLoading}>
                    {topupLoading ? "Processing..." : selectedPlanConfig.id === "free" ? "Activate Free Plan" : "Continue to Demo Top-up"}
                  </Button>
                </div>
              </div>
            )}

            {onboardingStep === 3 && (
              <div className="space-y-4">
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    Demo billing mode: no real charges will be applied.
                  </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <Label>Demo account name *</Label>
                    <Input
                      value={paymentForm.cardName}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, cardName: e.target.value }))}
                    />
                    {paymentErrors.cardName && <p className="text-xs text-destructive mt-1">{paymentErrors.cardName}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label>Demo reference number *</Label>
                    <Input
                      value={paymentForm.cardNumber}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, cardNumber: toCardNumber(e.target.value) }))}
                      placeholder="DEMO 4242 4242 4242"
                    />
                    {paymentErrors.cardNumber && <p className="text-xs text-destructive mt-1">{paymentErrors.cardNumber}</p>}
                  </div>
                  <div>
                    <Label>Plan cycle (MM/YY) *</Label>
                    <Input
                      value={paymentForm.expiry}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, expiry: toExpiry(e.target.value) }))}
                      placeholder="12/26"
                    />
                    {paymentErrors.expiry && <p className="text-xs text-destructive mt-1">{paymentErrors.expiry}</p>}
                  </div>
                  <div>
                    <Label>Demo code *</Label>
                    <Input
                      value={paymentForm.cvv}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, cvv: toCvv(e.target.value) }))}
                      placeholder="123"
                    />
                    {paymentErrors.cvv && <p className="text-xs text-destructive mt-1">{paymentErrors.cvv}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label>Billing address *</Label>
                    <Input
                      value={paymentForm.billingAddress}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, billingAddress: e.target.value }))}
                    />
                    {paymentErrors.billingAddress && <p className="text-xs text-destructive mt-1">{paymentErrors.billingAddress}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label>GST / Tax ID (optional)</Label>
                    <Input
                      value={paymentForm.gstId}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, gstId: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-between gap-2">
                  <Button variant="outline" onClick={() => setOnboardingStep(2)} disabled={topupLoading}>Back</Button>
                  <Button onClick={completePaidOnboarding} disabled={topupLoading}>
                    {topupLoading ? "Processing..." : `Grant Rs ${selectedPlanConfig.amountInrMonthly} demo top-up`}
                  </Button>
                </div>
              </div>
            )}

            {onboardingStep === 4 && onboardingResult && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-emerald-50 p-4">
                  <p className="text-sm text-emerald-800">Demo subscription activated successfully.</p>
                  <p className="font-semibold mt-1">Demo reference: {onboardingResult.paymentRef}</p>
                  <p className="text-sm mt-1">Plan: {onboardingResult.planName}</p>
                  <p className="text-sm mt-1">Tokens added: {new Intl.NumberFormat("en-IN").format(onboardingResult.tokensAdded)}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setTopupOpen(false)}>Close</Button>
                  <Button
                    onClick={() => {
                      setTopupOpen(false);
                      navigate("/qos/predict");
                    }}
                  >
                    Run first prediction
                  </Button>
                </div>
              </div>
            )}
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
