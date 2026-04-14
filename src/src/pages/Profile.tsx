import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Building, Heart, TestTube, Star, Sparkles, Wallet, Coins, ReceiptText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/Header';
import { ServiceCard } from '@/components/ServiceCard';
import { ScrollableRow } from '@/components/ScrollableRow';
import { requireUser } from '@/lib/auth';
import { extractFunctionErrorMessage, invokeWithLiveToken } from '@/lib/live-token';
import { Progress } from '@/components/ui/progress';
import { useTokenUsage } from '@/hooks/useTokenUsage';

type TokenTransaction = {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  balance_after: number;
  description: string;
  endpoint: string | null;
  created_at: string;
};

type PaymentRecord = {
  id: string;
  amount_in_paise: number;
  tokens_purchased: number;
  status: 'pending' | 'success' | 'failed';
  pack_name: string | null;
  created_at: string;
};

type TopUpRecord = {
  id: string;
  amount_paid: number;
  tokens_added: number;
  status: 'pending' | 'completed' | 'failed';
  package_selected: string | null;
  created_at: string;
};

type PackName = 'starter' | 'growth' | 'pro';

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [profileExists, setProfileExists] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [recentTests, setRecentTests] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [tokenTransactions, setTokenTransactions] = useState<TokenTransaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [paymentInitiated, setPaymentInitiated] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [topUpLoading, setTopUpLoading] = useState<Record<PackName, boolean>>({
    starter: false,
    growth: false,
    pro: false,
  });
  const { tokenUsage, usagePercent, refreshTokenUsage, applyOptimisticBalance, balanceUpdatedAt, balanceRecentlyUpdated, liveStatus } = useTokenUsage();
  const tokenChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const tokenRefreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    fetchProfile();
    fetchUserActivity();
    fetchSubscriptionData();
    void refreshTokenUsage();
  }, []);

  useEffect(() => {
    let mounted = true;

    const scheduleRefresh = () => {
      if (tokenRefreshTimerRef.current) window.clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = window.setTimeout(() => {
        void fetchSubscriptionData();
      }, 250);
    };

    const setupRealtime = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted || !user) return;

      if (tokenChannelRef.current) {
        supabase.removeChannel(tokenChannelRef.current);
      }

      const channel = supabase
        .channel(`token-live-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_profiles', filter: `id=eq.${user.id}` },
          scheduleRefresh,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'token_transactions', filter: `user_id=eq.${user.id}` },
          scheduleRefresh,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'payments', filter: `user_id=eq.${user.id}` },
          scheduleRefresh,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'topup_records', filter: `user_id=eq.${user.id}` },
          scheduleRefresh,
        )
        .subscribe();

      tokenChannelRef.current = channel;
    };

    setupRealtime();

    return () => {
      mounted = false;
      if (tokenRefreshTimerRef.current) window.clearTimeout(tokenRefreshTimerRef.current);
      if (tokenChannelRef.current) supabase.removeChannel(tokenChannelRef.current);
    };
  }, []);

  useEffect(() => {
    const hasPendingPayment = paymentHistory.some((payment) => {
      if (payment.status !== 'pending') return false;
      const ageMs = Date.now() - new Date(payment.created_at).getTime();
      return ageMs <= 15 * 60 * 1000;
    });
    if (!hasPendingPayment) return;

    const poller = setInterval(() => {
      void fetchSubscriptionData();
    }, 5000);

    return () => clearInterval(poller);
  }, [paymentHistory]);

  useEffect(() => {
    if (!balanceUpdatedAt) return;
    if (tokenRefreshTimerRef.current) window.clearTimeout(tokenRefreshTimerRef.current);
    tokenRefreshTimerRef.current = window.setTimeout(() => {
      void fetchSubscriptionData();
    }, 200);
  }, [balanceUpdatedAt]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [banner]);

  useEffect(() => {
    return () => {
      setIsProcessingPayment(false);
      setPaymentInitiated(false);
    };
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth/login');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile(data);
        setProfileExists(true);
        return;
      }

      const draftProfile = {
        id: user.id,
        email: user.email ?? '',
        name: 'User',
        username: null,
        bio: null,
        organization: null,
      };
      setProfileExists(false);
      setProfile(draftProfile);

      const { error: createError } = await supabase.from('profiles').upsert(draftProfile);
      if (createError) throw createError;

      setProfileExists(true);
      setBanner('Profile created successfully.');
    } catch (error: any) {
      toast({
        title: 'Error loading profile',
        description:
          error.message ||
          'Unable to load or create your profile. Make sure your Supabase policies allow inserting profiles.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserActivity = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch favorites with service details
      const { data: favData } = await supabase
        .from('web_service_favorites')
        .select('*, web_services(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch recent tests
      const { data: testsData } = await supabase
        .from('tests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch user ratings
      const { data: ratingsData } = await supabase
        .from('web_service_ratings')
        .select('*, web_services(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setFavorites(favData || []);
      setRecentTests(testsData || []);
      setRatings(ratingsData || []);
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  };

  const fetchSubscriptionData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const db = supabase as any;

      const [transactionsRes, paymentsRes, topupsRes] = await Promise.all([
        db
          .from('token_transactions')
          .select('id, type, amount, balance_after, description, endpoint, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
        db
          .from('payments')
          .select('id, amount_in_paise, tokens_purchased, status, pack_name, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
        db
          .from('topup_records')
          .select('id, amount_paid, tokens_added, status, package_selected, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);
      if (!transactionsRes.error) {
        setTokenTransactions((transactionsRes.data || []) as TokenTransaction[]);
      }
      const payments = !paymentsRes.error ? ((paymentsRes.data || []) as PaymentRecord[]) : [];
      const topups = !topupsRes.error ? ((topupsRes.data || []) as TopUpRecord[]) : [];
      const normalizedTopups: PaymentRecord[] = topups.map((row) => ({
        id: `topup-${row.id}`,
        amount_in_paise: Math.round(Number(row.amount_paid || 0) * 100),
        tokens_purchased: Number(row.tokens_added || 0),
        status: row.status === 'completed' ? 'success' : row.status,
        pack_name: row.package_selected,
        created_at: row.created_at,
      }));
      const mergedPayments = [...payments, ...normalizedTopups]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 12);
      setPaymentHistory(mergedPayments);
    } catch (error) {
      console.error('Error fetching subscription details:', error);
    }
  };

  const formatNumber = (value: number) => new Intl.NumberFormat('en-IN').format(value || 0);
  const formatRupeesFromPaise = (paise: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
      (paise || 0) / 100,
    );

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 10000): Promise<T> => {
    let timer: number | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error('Request timed out. Please try again.')), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  };

  const handleTopUp = async (pack: PackName) => {
    setPaymentInitiated(true);
    setIsProcessingPayment(true);
    setTopUpLoading((prev) => ({ ...prev, [pack]: true }));
    try {
      const user = await requireUser();

      const { data: orderData, error: orderError } = await withTimeout(
        invokeWithLiveToken('payments-create-order', {
          body: { pack },
        }),
      );
      if (orderError) throw orderError;
      if ((orderData as { error?: string } | null)?.error) {
        throw new Error((orderData as { error?: string }).error);
      }

      if (typeof orderData?.newBalance === 'number') {
        applyOptimisticBalance(orderData.newBalance);
      }

      toast({
        title: 'Demo top-up successful',
        description: `Tokens credited instantly. New balance: ${orderData?.newBalance ?? 'updated'}`,
      });
      await fetchSubscriptionData();
      await refreshTokenUsage();
    } catch (error: any) {
      const message = await extractFunctionErrorMessage(error, 'Could not start token top-up.');
      if (error?.message?.includes('Authentication')) {
        navigate('/auth/login');
      }
      toast({
        title: 'Top-up failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessingPayment(false);
      setPaymentInitiated(false);
      setTopUpLoading((prev) => ({ ...prev, [pack]: false }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const user = await requireUser();
      const name = (profile?.name || '').trim() || 'User';
      const username = (profile?.username || '').trim() || null;
      const bio = (profile?.bio || '').trim() || null;
      const organization = (profile?.organization || '').trim() || null;
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name,
          email: user.email ?? profile.email,
          username,
          bio,
          organization,
        });

      if (error) throw error;

      toast({
        title: 'Profile updated',
        description: 'Your profile has been saved successfully.',
      });
      setProfileExists(true);
      setBanner('Profile saved successfully.');
    } catch (error: any) {
      if (error?.message?.includes('Authentication')) {
        navigate('/auth/login');
      }
      toast({
        title: 'Error saving profile',
        description:
          error.message ||
          'Save failed. This can happen if your profile policies don’t allow insert/update or required fields are missing.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  const hasPendingPayment = paymentHistory.some((payment) => {
    if (payment.status !== 'pending') return false;
    const ageMs = Date.now() - new Date(payment.created_at).getTime();
    return ageMs <= 15 * 60 * 1000;
  });
  const showProcessingBanner = paymentInitiated && (isProcessingPayment || hasPendingPayment);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8 relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-40 -left-10 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative overflow-hidden rounded-3xl p-8 md:p-12 hero-surface text-white mb-8">
            <div className="absolute inset-0 hero-veil" />
            <div className="absolute inset-0 opacity-30 pattern-dots" />
            <div className="absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Personal Workspace
                </div>
                <h1 className="text-4xl md:text-5xl font-semibold leading-tight">My Profile</h1>
                <p className="text-white/80 text-base md:text-lg">
                  Manage your identity, preferences, and QoS activity in one place.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center text-xl font-semibold">
                  {(profile?.name || 'U').trim().slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-semibold">{profile?.name || 'User'}</p>
                  <p className="text-sm text-white/80">{profile?.email || ''}</p>
                </div>
              </div>
            </div>
          </div>
          {banner && (
            <Card className="brand-card mb-6 border-emerald-500/50">
              <CardContent className="py-4 text-emerald-700">{banner}</CardContent>
            </Card>
          )}

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="bg-white/80 backdrop-blur-sm border border-border/70">
              <TabsTrigger value="profile">Profile Info</TabsTrigger>
              <TabsTrigger value="subscription">Subscription</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card className="brand-card hover-scale">
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your personal information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">
                        <User className="inline h-4 w-4 mr-2" />
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        value={profile?.name || ''}
                        onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username">
                        <User className="inline h-4 w-4 mr-2" />
                        Username
                      </Label>
                      <Input
                        id="username"
                        value={profile?.username || ''}
                        onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">
                      <Mail className="inline h-4 w-4 mr-2" />
                      Email
                    </Label>
                    <Input id="email" value={profile?.email || ''} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organization">
                      <Building className="inline h-4 w-4 mr-2" />
                      Organization
                    </Label>
                    <Input
                      id="organization"
                      value={profile?.organization || ''}
                      onChange={(e) => setProfile({ ...profile, organization: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={profile?.bio || ''}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscription">
              <div className="space-y-6">
                {showProcessingBanner && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-amber-300/50 bg-amber-50 px-4 py-3 text-amber-800"
                  >
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Payment is processing. Auto-refresh is active.
                    </p>
                  </motion.div>
                )}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="brand-card hover-scale">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Current Balance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-semibold">
                        <span className={balanceRecentlyUpdated ? "text-emerald-600 transition-colors" : ""}>
                          {formatNumber(tokenUsage.balance || 0)}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Available tokens</p>
                      <p className="text-xs mt-1 text-emerald-700">
                        {balanceUpdatedAt ? `Updated ${new Date(balanceUpdatedAt).toLocaleTimeString()}` : "Waiting for sync"}
                      </p>
                      <p className="text-xs mt-1">
                        {liveStatus === 'live' ? 'Live' : liveStatus === 'reconnecting' ? 'Reconnecting...' : 'Live updates paused'}
                      </p>
                      {tokenUsage.stale && <p className="text-xs text-amber-600">May be outdated</p>}
                    </CardContent>
                  </Card>

                  <Card className="brand-card hover-scale">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        Lifetime Used
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-semibold">
                        {formatNumber(tokenUsage.lifetimeUsed || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Total consumed tokens</p>
                    </CardContent>
                  </Card>

                  <Card className="brand-card hover-scale">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ReceiptText className="h-4 w-4" />
                        Plan Type
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-semibold">Free + Top-up</p>
                      <p className="text-xs text-muted-foreground mt-1">Pay only when tokens run low</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="brand-card hover-scale">
                  <CardHeader>
                    <CardTitle>Top Up Tokens</CardTitle>
                    <CardDescription>Buy additional tokens when your balance is low</CardDescription>
                    <p className="text-xs mt-1">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                          liveStatus === 'live'
                            ? 'bg-emerald-100 text-emerald-700'
                            : liveStatus === 'reconnecting'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        Live sync: {liveStatus}
                      </span>
                    </p>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    <Button type="button" variant="ghost" className="md:col-span-3 justify-start" onClick={() => navigate('/settings/billing?topup=1')}>
                      Open detailed top-up form
                    </Button>
                    <Button type="button" className="transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0" onClick={() => void handleTopUp('starter')} disabled={topUpLoading.starter}>
                      {topUpLoading.starter ? 'Starting...' : 'Starter Rs 199'}
                    </Button>
                    <Button type="button" variant="secondary" className="transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0" onClick={() => void handleTopUp('growth')} disabled={topUpLoading.growth}>
                      {topUpLoading.growth ? 'Starting...' : 'Growth Rs 499'}
                    </Button>
                    <Button type="button" variant="outline" className="transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0" onClick={() => void handleTopUp('pro')} disabled={topUpLoading.pro}>
                      {topUpLoading.pro ? 'Starting...' : 'Pro Rs 1499'}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="brand-card hover-scale">
                  <CardHeader>
                    <CardTitle>Token Usage (Billing Cycle)</CardTitle>
                    <CardDescription>
                      {new Intl.NumberFormat('en-IN').format(tokenUsage.cycleUsed)} / {new Intl.NumberFormat('en-IN').format(tokenUsage.cycleLimit)} tokens used
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Progress value={usagePercent} />
                    <p className="text-sm text-muted-foreground">
                      You've run {tokenUsage.weeklyLatencyTests} latency tests ({new Intl.NumberFormat('en-IN').format(tokenUsage.weeklyLatencyTokens)} tokens) this week.
                    </p>
                    {tokenUsage.stale && (
                      <p className="text-xs text-amber-600">Showing last known token state (stale data).</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="brand-card hover-scale">
                  <CardHeader>
                    <CardTitle>Per-Service Token Spend</CardTitle>
                    <CardDescription>Current billing cycle breakdown by monitored endpoint</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {tokenUsage.perServiceSpend.length > 0 ? (
                      <div className="space-y-3">
                        {tokenUsage.perServiceSpend.map((row) => (
                          <div key={row.service} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                            <div>
                              <p className="font-medium truncate max-w-[280px]">{row.service}</p>
                              <p className="text-xs text-muted-foreground">{row.tests} tests</p>
                            </div>
                            <p className="text-sm font-semibold">{new Intl.NumberFormat('en-IN').format(row.tokens)} tokens</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No per-service spend yet</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="brand-card hover-scale">
                  <CardHeader>
                    <CardTitle>Recent Token Activity</CardTitle>
                    <CardDescription>Latest debits and credits from your account</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {tokenTransactions.length > 0 ? (
                      <div className="space-y-3">
                        {tokenTransactions.map((tx, index) => (
                          <motion.div
                            key={tx.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.03 }}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div>
                              <p className="font-medium">
                                <span className={tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}>
                                  {tx.type === 'credit' ? '+' : '-'} {formatNumber(tx.amount)}
                                </span>{' '}
                                tokens
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {tx.description} {tx.endpoint ? `- ${tx.endpoint}` : ''} - Balance: {formatNumber(tx.balance_after)}
                              </p>
                            </div>
                            <div className="text-sm text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No token transactions yet</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="brand-card hover-scale">
                  <CardHeader>
                    <CardTitle>Recent Top-ups</CardTitle>
                    <CardDescription>Your latest payment attempts and statuses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {paymentHistory.length > 0 ? (
                      <div className="space-y-3">
                        {paymentHistory.map((payment, index) => (
                          <motion.div
                            key={payment.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.03 }}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div>
                              <p className="font-medium">
                                {formatRupeesFromPaise(payment.amount_in_paise)} - {formatNumber(payment.tokens_purchased)} tokens
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Pack: {payment.pack_name || 'custom'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p
                                className={`text-sm font-medium ${
                                  payment.status === 'success'
                                    ? 'text-emerald-600'
                                    : payment.status === 'failed'
                                      ? 'text-rose-600'
                                      : 'text-amber-600'
                                }`}
                              >
                                {payment.status}
                              </p>
                              <p className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleDateString()}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No top-up payments yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="activity">
              <div className="space-y-6">
                <Card className="brand-card hover-scale">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TestTube className="h-5 w-5" />
                      Recent Tests ({recentTests.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentTests.length > 0 ? (
                      <div className="space-y-3">
                        {recentTests.map((test) => (
                          <div key={test.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="font-medium">{test.service_url || 'Unknown Service'}</p>
                              <p className="text-sm text-muted-foreground">
                                {test.test_type} - {test.latency}ms
                              </p>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(test.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No tests yet</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="brand-card hover-scale">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5" />
                      Your Ratings ({ratings.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ratings.length > 0 ? (
                      <div className="space-y-3">
                        {ratings.map((rating) => (
                          <div key={rating.id} className="p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium">{rating.web_services?.service_name || rating.web_services?.name || 'Unknown Service'}</p>
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-4 w-4 ${i < rating.rating ? 'fill-primary text-primary' : 'text-muted'}`}
                                  />
                                ))}
                              </div>
                            </div>
                            {rating.comment && (
                              <p className="text-sm text-muted-foreground">{rating.comment}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No ratings yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="favorites">
              <Card className="brand-card hover-scale">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Favorite Services ({favorites.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {favorites.length > 0 ? (
                    <ScrollableRow title="">
                      {favorites.map((fav) => (
                        <ServiceCard
                          key={fav.id}
                          serviceName={fav.web_services?.service_name || fav.web_services?.name || 'Unknown'}
                          latency={fav.web_services?.avg_latency || fav.web_services?.base_latency_estimate || 0}
                          uptime={99.5}
                          status="stable"
                          lastTested="Recently"
                        />
                      ))}
                    </ScrollableRow>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No favorites yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}


