import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Cpu,
  Globe,
  IndianRupee,
  LineChart,
  Lock,
  WalletCards,
  Shield,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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

const tickerItems = [
  'api.zenstack.io',
  'edge.fastlane.dev',
  'billing.orbit.io',
  'auth.nexium.app',
  'search.kite.ai',
  'cdn.quanta.net',
  'hooks.streamly.io',
  'events.axis.app',
  'media.vecta.io',
  'audit.prism.dev',
];

const stats = [
  { label: 'Uptime', value: '99.99%' },
  { label: 'P95 latency', value: '128ms' },
  { label: 'Requests/day', value: '2.4B' },
  { label: 'Regions', value: '28' },
];

const features = [
  {
    icon: LineChart,
    title: 'Unified performance graph',
    description: 'See latency, throughput, and errors on a single timeline with clear baselines.',
  },
  {
    icon: Cpu,
    title: 'AI signal extraction',
    description: 'Detect hidden correlations and surface the real root cause without noise.',
  },
  {
    icon: Globe,
    title: 'Global service topology',
    description: 'Understand impact by region and rollout safely with confidence.',
  },
];

const capabilities = [
  'Automated service health checks and anomaly flags',
  'Predictive SLA risk scoring per endpoint',
  'Live incident timeline with shared notes',
  'Performance baselines for every release',
  'Secure audit trails with role controls',
  'Integrated alerts to Slack and PagerDuty',
];

const pricing = [
  {
    pack: 'starter' as PackName,
    name: 'Starter Pack',
    price: '₹199',
    description: 'Great for demos and assignment submissions.',
    items: ['50,000 tokens', 'Realtime usage feed', 'Token transaction logs', 'Priority queue'],
  },
  {
    pack: 'growth' as PackName,
    name: 'Growth Pack',
    price: '₹499',
    description: 'Best for active student teams and capstone builds.',
    items: ['150,000 tokens', 'Realtime usage feed', 'Detailed billing history', 'Faster response SLA'],
    featured: true,
  },
  {
    pack: 'pro' as PackName,
    name: 'Pro Pack',
    price: '₹999',
    description: 'For production-ready demos and public showcases.',
    items: ['400,000 tokens', 'Realtime balance updates', 'Webhook-safe credit flow', 'Premium support'],
  },
];

const tokenFlow = [
  {
    icon: WalletCards,
    title: 'Start free with 10,000 tokens',
    description: 'Every signup gets instant free tokens to test prediction and QoS routes.',
  },
  {
    icon: Zap,
    title: 'Pay only when you need more',
    description: 'Top up through predefined packs or custom amount with Razorpay.',
  },
  {
    icon: IndianRupee,
    title: 'Transparent, token-wise billing',
    description: 'Each API call logs debit/credit with balance snapshots and timestamps.',
  },
];

const studentFit = [
  'Production-style billing architecture with Supabase + Edge Functions',
  'Portfolio-friendly real payment flow (test mode first)',
  'Clear audit trail tables to explain in interviews and viva',
];

const testimonials = [
  {
    name: 'Asha R.',
    role: 'VP Engineering, Fluxgrid',
    quote:
      'The signal clarity is unreal. We went from guessing to knowing exactly where latency stacked up.',
  },
  {
    name: 'Marco L.',
    role: 'Head of SRE, HelioCloud',
    quote:
      'Our response times dropped 32% in two weeks after we rolled in their recommendations.',
  },
  {
    name: 'Priya S.',
    role: 'CTO, Portside',
    quote:
      'The dashboard became our release gate. If it is green here, it ships.',
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut' },
  viewport: { once: true },
};

export default function Landing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState<Record<PackName, boolean>>({
    starter: false,
    growth: false,
    pro: false,
  });

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

  const handleBuyTokens = async (pack: PackName) => {
    setCheckoutLoading((prev) => ({ ...prev, [pack]: true }));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: 'Login required',
          description: 'Please login first to purchase tokens.',
        });
        navigate('/auth/login');
        return;
      }

      const { data: orderData, error: orderError } = await supabase.functions.invoke('payments-create-order', {
        body: { pack },
      });

      if (orderError) throw orderError;

      const razorpayReady = await loadRazorpayScript();
      if (!razorpayReady || !window.Razorpay) {
        toast({
          title: 'Order Created',
          description: 'Razorpay checkout failed to load. Please try again.',
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
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('payments-verify', {
            body: response,
          });

          if (verifyError) throw verifyError;

          toast({
            title: 'Payment successful',
            description: `Tokens credited. New balance: ${verifyData?.newBalance ?? 'updated'}`,
          });
        },
      });

      razorpay.open();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not start checkout';
      toast({
        title: 'Top-up failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCheckoutLoading((prev) => ({ ...prev, [pack]: false }));
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    toast({
      title: 'Thanks for your interest',
      description: 'We will reach out with early access details shortly.',
    });
    setEmail('');
  };

  return (
    <div className="min-h-screen bg-[#090b10] text-slate-100">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.22),_transparent_45%),radial-gradient(circle_at_bottom,_rgba(34,211,238,0.18),_transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.03),transparent,rgba(255,255,255,0.05))]" />
        <div className="absolute inset-0 opacity-40 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:120px_120px]" />

        <motion.nav
          className="relative z-10 border-b border-white/10 backdrop-blur"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="container flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="h-5 w-5 text-sky-400" />
              QoSCollab
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/auth/login">
                <Button variant="ghost" className="text-slate-200">
                  Login
                </Button>
              </Link>
              <Link to="/auth/register">
                <Button className="bg-sky-500 text-slate-950 hover:bg-sky-400">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </motion.nav>

        <section className="container relative z-10 grid gap-12 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:py-28">
          <div className="space-y-8">
            <motion.div
              {...fadeUp}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-slate-300"
            >
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              Dark Precision SaaS
            </motion.div>

            <motion.h1
              {...fadeUp}
              className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl"
            >
              Reliable, AI-powered performance intelligence for modern services.
            </motion.h1>

            <motion.p {...fadeUp} className="max-w-xl text-lg text-slate-300">
              QoSCollab helps teams track service quality, predict risk, and ship faster with
              a clear operational view of every endpoint and a token-wise billing system that is
              simple enough for student projects and strong enough for real deployment.
            </motion.p>

            <motion.div {...fadeUp} className="flex flex-wrap gap-4">
              <Link to="/auth/register">
                <Button size="lg" className="bg-sky-500 text-slate-950 hover:bg-sky-400">
                  Start free (10,000 tokens)
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth/login">
                <Button size="lg" variant="outline" className="border-white/20 text-white">
                  View demo
                </Button>
              </Link>
            </motion.div>

            <motion.div {...fadeUp} className="grid gap-4 sm:grid-cols-2">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-slate-400">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            {...fadeUp}
            className="relative rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_80px_rgba(59,130,246,0.2)]"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Live view</p>
                <p className="text-lg font-semibold">Performance dashboard</p>
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                Healthy
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {['Edge latency', 'Error rate', 'Cache hit'].map((metric, index) => (
                <div key={metric} className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>{metric}</span>
                    <span className="text-white">{index === 1 ? '0.14%' : index === 2 ? '96%' : '118ms'}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-sky-400 to-indigo-400"
                      style={{ width: index === 1 ? '18%' : index === 2 ? '88%' : '62%' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-[#0f1118] p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Realtime trend</p>
              <svg viewBox="0 0 320 120" className="mt-3 h-24 w-full" role="img" aria-label="Latency sparkline">
                <polyline
                  fill="none"
                  stroke="url(#spark)"
                  strokeWidth="3"
                  points="0,80 40,60 80,65 120,40 160,55 200,30 240,45 280,20 320,30"
                />
                <defs>
                  <linearGradient id="spark" x1="0" x2="1">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span>Last 24 hours</span>
                <span className="text-emerald-300">-18% latency</span>
              </div>
            </div>

            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border border-white/10" />
          </motion.div>
        </section>
      </div>

      <section className="border-y border-white/10 bg-[#0b0d14]">
        <div className="container py-8">
          <div className="overflow-hidden">
            <div className="flex min-w-max items-center gap-8 text-sm text-slate-400 animate-marquee">
              {tickerItems.concat(tickerItems).map((item, index) => (
                <span key={`${item}-${index}`} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container py-24">
        <motion.div {...fadeUp} className="max-w-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Product</p>
          <h2 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
            A focused command center for service quality.
          </h2>
          <p className="mt-4 text-slate-300">
            Cut through noisy monitoring stacks with a single workspace tuned for SaaS reliability,
            rollout confidence, and customer trust.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {features.map((feature) => (
            <motion.div key={feature.title} {...fadeUp}>
              <Card className="h-full border border-white/10 bg-white/5">
                <CardHeader>
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
                    <feature.icon className="h-5 w-5 text-sky-400" />
                  </div>
                  <CardTitle className="text-xl text-white">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-300">
                  {feature.description}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="bg-[#0b0d14] py-24">
        <div className="container grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <motion.div {...fadeUp} className="space-y-6">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Capabilities</p>
            <h3 className="text-3xl font-semibold text-white">Built for teams shipping every day.</h3>
            <p className="text-slate-300">
              Everything you need to move fast without sacrificing reliability. Use QoSCollab as
              your shared decision engine across product, SRE, and leadership.
            </p>
            <div className="grid gap-3">
              {capabilities.map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-sky-300">
                    <Check className="h-3 w-3" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div {...fadeUp} className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Live readiness score</p>
                <p className="text-2xl font-semibold text-white">92 / 100</p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {[
                { label: 'Latency budget', value: '12ms under goal', positive: true },
                { label: 'Error volatility', value: '+0.08%', positive: true },
                { label: 'Recent regressions', value: '2 flagged', positive: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-4 py-3 text-sm">
                  <span className="text-slate-300">{item.label}</span>
                  <span className={item.positive ? 'text-emerald-300' : 'text-amber-300'}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between rounded-xl border border-white/5 bg-black/40 px-4 py-3 text-sm text-slate-300">
              <span>Next risk window</span>
              <span className="text-white">Tomorrow, 09:30 UTC</span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="container py-24">
        <motion.div {...fadeUp} className="text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Token Packs</p>
          <h3 className="mt-4 text-3xl font-semibold text-white">Free tier + top-ups that feel fair.</h3>
          <p className="mt-4 text-slate-300">Start at zero cost, then scale usage by tokens as your project grows.</p>
        </motion.div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {pricing.map((plan) => (
            <motion.div key={plan.name} {...fadeUp}>
              <Card
                className={`h-full border ${
                  plan.featured
                    ? 'border-sky-400 bg-sky-500/10 shadow-[0_0_40px_rgba(56,189,248,0.25)]'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <CardHeader>
                  <CardTitle className="text-xl text-white">{plan.name}</CardTitle>
                  <div className="mt-4 text-3xl font-semibold text-white">{plan.price}</div>
                  <p className="mt-2 text-sm text-slate-300">{plan.description}</p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-300">
                  {plan.items.map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-sky-400" />
                      {item}
                    </div>
                  ))}
                  <Button
                    type="button"
                    onClick={() => void handleBuyTokens(plan.pack)}
                    disabled={checkoutLoading[plan.pack]}
                    className={`mt-6 w-full ${
                      plan.featured
                        ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                        : 'border border-white/20 bg-transparent text-white hover:border-sky-400'
                    }`}
                  >
                    {checkoutLoading[plan.pack] ? 'Starting checkout...' : 'Buy tokens'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="bg-[#0b0d14] py-24">
        <div className="container grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div {...fadeUp}>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Billing Flow</p>
            <h3 className="mt-4 text-3xl font-semibold text-white">How token billing works in production.</h3>
            <p className="mt-4 text-slate-300">
              Built with atomic token deduction, idempotent credits, and realtime balance updates.
              No manual refresh and no double-credit risk.
            </p>
            <div className="mt-8 grid gap-4">
              {tokenFlow.map((item) => (
                <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-medium text-white">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-300">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div {...fadeUp} className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Student Builder Fit</p>
            <h4 className="mt-4 text-2xl font-semibold text-white">
              Real-world architecture, beginner-friendly presentation.
            </h4>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              {studentFit.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-sky-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <Link to="/qos/run-test">
                <Button className="w-full bg-sky-500 text-slate-950 hover:bg-sky-400">
                  Try live token-protected endpoint
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#0b0d14] py-24">
        <div className="container">
          <motion.div {...fadeUp} className="max-w-2xl">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Testimonials</p>
            <h3 className="mt-4 text-3xl font-semibold text-white">Teams trust QoSCollab daily.</h3>
          </motion.div>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {testimonials.map((item) => (
              <motion.div key={item.name} {...fadeUp}>
                <Card className="h-full border border-white/10 bg-white/5">
                  <CardContent className="space-y-4 pt-6">
                    <p className="text-sm text-slate-300">"{item.quote}"</p>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.name}</p>
                      <p className="text-xs text-slate-400">{item.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-20">
        <motion.div
          {...fadeUp}
          className="flex flex-col items-start justify-between gap-8 rounded-3xl border border-white/10 bg-white/5 p-10 lg:flex-row lg:items-center"
        >
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Early access</p>
            <h3 className="mt-4 text-3xl font-semibold text-white">Stay ahead of every regression.</h3>
            <p className="mt-3 text-slate-300">
              Join the early access list to receive roadmap updates, templates, and launch perks.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="flex w-full max-w-md gap-3">
            <Input
              type="email"
              placeholder="Work email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="border-white/20 bg-black/40 text-white placeholder:text-slate-500"
            />
            <Button type="submit" className="bg-sky-500 text-slate-950 hover:bg-sky-400">
              Notify me
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </motion.div>
      </section>

      <footer className="border-t border-white/10 bg-[#0b0d14] py-10">
        <div className="container flex flex-col items-start justify-between gap-6 text-sm text-slate-400 md:flex-row md:items-center">
          <div className="flex items-center gap-2 text-white">
            <BarChart3 className="h-5 w-5 text-sky-400" />
            QoSCollab
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-sky-400" />
              SOC 2 ready
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-sky-400" />
              GDPR compliant
            </div>
          </div>
          <p>© {new Date().getFullYear()} QoSCollab</p>
        </div>
      </footer>
    </div>
  );
}

