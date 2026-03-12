import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Cpu,
  Globe,
  LineChart,
  Lock,
  Shield,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

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
    name: 'Launch',
    price: '$49',
    description: 'For small teams validating performance goals.',
    items: ['Up to 5 services', 'Daily insights', 'Email alerts', 'Community support'],
  },
  {
    name: 'Scale',
    price: '$149',
    description: 'For growing SaaS teams running multi-region workloads.',
    items: ['Up to 25 services', 'Real-time insights', 'Advanced dashboards', 'Slack alerts'],
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For platforms with strict SLAs and compliance needs.',
    items: ['Unlimited services', 'Private SLAs', 'On-call response', 'Dedicated support'],
  },
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
  const { toast } = useToast();
  const [email, setEmail] = useState('');

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
              a clear operational view of every endpoint.
            </motion.p>

            <motion.div {...fadeUp} className="flex flex-wrap gap-4">
              <Link to="/auth/register">
                <Button size="lg" className="bg-sky-500 text-slate-950 hover:bg-sky-400">
                  Start free trial
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
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Pricing</p>
          <h3 className="mt-4 text-3xl font-semibold text-white">Plans that scale with you.</h3>
          <p className="mt-4 text-slate-300">Simple tiers built for growing engineering teams.</p>
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
                    className={`mt-6 w-full ${
                      plan.featured
                        ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                        : 'border border-white/20 bg-transparent text-white hover:border-sky-400'
                    }`}
                  >
                    Choose plan
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
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
