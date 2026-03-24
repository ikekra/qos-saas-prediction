import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Building, Heart, TestTube, Star, Sparkles, Wallet, Coins, ReceiptText } from 'lucide-react';
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

type UserSubscription = {
  token_balance: number;
  lifetime_tokens_used: number;
  created_at: string | null;
};

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

type PackName = 'starter' | 'growth' | 'pro';

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => Promise<void>;
  prefill?: {
    email?: string;
  };
  theme?: {
    color: string;
  };
};

type RazorpayInstance = {
  open: () => void;
};

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

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
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [tokenTransactions, setTokenTransactions] = useState<TokenTransaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [topUpLoading, setTopUpLoading] = useState<Record<PackName, boolean>>({
    starter: false,
    growth: false,
    pro: false,
  });

  useEffect(() => {
    fetchProfile();
    fetchUserActivity();
    fetchSubscriptionData();
  }, []);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(timer);
  }, [banner]);

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

      const [subscriptionRes, transactionsRes, paymentsRes] = await Promise.all([
        db
          .from('user_profiles')
          .select('token_balance, lifetime_tokens_used, created_at')
          .eq('id', user.id)
          .maybeSingle(),
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
      ]);

      if (!subscriptionRes.error && subscriptionRes.data) {
        setSubscription(subscriptionRes.data as UserSubscription);
      }
      if (!transactionsRes.error) {
        setTokenTransactions((transactionsRes.data || []) as TokenTransaction[]);
      }
      if (!paymentsRes.error) {
        setPaymentHistory((paymentsRes.data || []) as PaymentRecord[]);
      }
    } catch (error) {
      console.error('Error fetching subscription details:', error);
    }
  };

  const formatNumber = (value: number) => new Intl.NumberFormat('en-IN').format(value || 0);
  const formatRupeesFromPaise = (paise: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
      (paise || 0) / 100,
    );

  const loadRazorpayScript = async () => {
    if (window.Razorpay) return true;
    return await new Promise<boolean>((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleTopUp = async (pack: PackName) => {
    setTopUpLoading((prev) => ({ ...prev, [pack]: true }));
    try {
      const user = await requireUser();

      const { data: orderData, error: orderError } = await supabase.functions.invoke('payments-create-order', {
        body: { pack },
      });
      if (orderError) throw orderError;

      const razorpayReady = await loadRazorpayScript();
      if (!razorpayReady || !window.Razorpay) {
        toast({
          title: 'Checkout unavailable',
          description: 'Could not load Razorpay checkout. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      const razorpay = new window.Razorpay({
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'QoSCollab',
        description: `${pack.toUpperCase()} token top-up`,
        order_id: orderData.orderId,
        prefill: { email: user.email ?? undefined },
        theme: { color: '#0ea5e9' },
        handler: async (response: RazorpaySuccessResponse) => {
          const { error: verifyError } = await supabase.functions.invoke('payments-verify', {
            body: response,
          });
          if (verifyError) throw verifyError;

          toast({
            title: 'Top-up successful',
            description: 'Payment verified and tokens credited.',
          });
          await fetchSubscriptionData();
        },
      });

      razorpay.open();
    } catch (error: any) {
      if (error?.message?.includes('Authentication')) {
        navigate('/auth/login');
      }
      toast({
        title: 'Top-up failed',
        description: error?.message || 'Could not start token top-up.',
        variant: 'destructive',
      });
    } finally {
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
              <Card className="brand-card">
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
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="brand-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Current Balance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-semibold">{formatNumber(subscription?.token_balance || 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Available tokens</p>
                    </CardContent>
                  </Card>

                  <Card className="brand-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        Lifetime Used
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-semibold">{formatNumber(subscription?.lifetime_tokens_used || 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total consumed tokens</p>
                    </CardContent>
                  </Card>

                  <Card className="brand-card">
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

                <Card className="brand-card">
                  <CardHeader>
                    <CardTitle>Top Up Tokens</CardTitle>
                    <CardDescription>Buy additional tokens when your balance is low</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-3">
                    <Button type="button" onClick={() => void handleTopUp('starter')} disabled={topUpLoading.starter}>
                      {topUpLoading.starter ? 'Starting...' : 'Starter ₹199'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => void handleTopUp('growth')} disabled={topUpLoading.growth}>
                      {topUpLoading.growth ? 'Starting...' : 'Growth ₹499'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void handleTopUp('pro')} disabled={topUpLoading.pro}>
                      {topUpLoading.pro ? 'Starting...' : 'Pro ₹999'}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="brand-card">
                  <CardHeader>
                    <CardTitle>Recent Token Activity</CardTitle>
                    <CardDescription>Latest debits and credits from your account</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {tokenTransactions.length > 0 ? (
                      <div className="space-y-3">
                        {tokenTransactions.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="font-medium">
                                <span className={tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}>
                                  {tx.type === 'credit' ? '+' : '-'} {formatNumber(tx.amount)}
                                </span>{' '}
                                tokens
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {tx.description} {tx.endpoint ? `• ${tx.endpoint}` : ''} • Balance: {formatNumber(tx.balance_after)}
                              </p>
                            </div>
                            <div className="text-sm text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">No token transactions yet</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="brand-card">
                  <CardHeader>
                    <CardTitle>Recent Top-ups</CardTitle>
                    <CardDescription>Your latest payment attempts and statuses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {paymentHistory.length > 0 ? (
                      <div className="space-y-3">
                        {paymentHistory.map((payment) => (
                          <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <div>
                              <p className="font-medium">
                                {formatRupeesFromPaise(payment.amount_in_paise)} • {formatNumber(payment.tokens_purchased)} tokens
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
                          </div>
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
                <Card className="brand-card">
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
                                {test.test_type} • {test.latency}ms
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

                <Card className="brand-card">
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
              <Card className="brand-card">
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
