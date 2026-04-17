import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, easeOut } from "framer-motion";
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  Gauge,
  Globe2,
  Headset,
  LifeBuoy,
  Mail,
  Menu,
  Rocket,
  ScanSearch,
  ShieldCheck,
  ShieldEllipsis,
  Smartphone,
  Sparkles,
  Star,
  TrendingDown,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/hero-qos-monitoring.jpg";

const socialProof = [
  { label: "Checks Executed", value: "2.4M+" },
  { label: "Teams Onboarded", value: "1,800+" },
  { label: "Average Uptime Tracked", value: "99.95%" },
  { label: "Global Endpoints", value: "42 Countries" },
];

const featureCards = [
  {
    title: "Real-Time Observability",
    description:
      "Track p50, p95, and p99 latency, uptime, and failure rates from one executive dashboard.",
    icon: Gauge,
  },
  {
    title: "Smart Alerting",
    description:
      "Route SLA and incident alerts to email instantly with threshold and severity controls.",
    icon: Bell,
  },
  {
    title: "Token-Based Efficiency",
    description:
      "Scale monitoring economically with predictable token usage and transparent billing.",
    icon: Zap,
  },
];

const integrations = [
  "Slack",
  "Microsoft Teams",
  "PagerDuty",
  "Grafana",
  "Prometheus",
  "Webhooks",
];

const useCases = [
  {
    title: "SaaS Product Teams",
    description:
      "Track app response times and uptime for customer-facing flows before churn risk appears.",
    icon: Rocket,
  },
  {
    title: "API Platforms",
    description:
      "Continuously validate endpoint reliability and detect regional degradation across your API estate.",
    icon: Code2,
  },
  {
    title: "Managed Service Ops",
    description:
      "Centralize service health monitoring across client environments with shared incident visibility.",
    icon: BriefcaseBusiness,
  },
];

const steps = [
  {
    title: "Connect Services",
    text: "Add your API or website endpoints in minutes with guided setup.",
  },
  {
    title: "Set Reliability Goals",
    text: "Define SLAs, thresholds, and alert policies per business-critical service.",
  },
  {
    title: "Act Before Customers Notice",
    text: "Receive live degradation signals and respond quickly with clear incident context.",
  },
];

const pricing = [
  {
    name: "Starter",
    monthlyPrice: 0,
    note: "Best for pilots",
    highlights: ["5,000 tokens", "Up to 5 services", "Email alerts", "7-day history"],
    cta: "Start Free",
    featured: false,
  },
  {
    name: "Growth",
    monthlyPrice: 499,
    note: "Most popular",
    highlights: ["50,000 tokens", "Up to 25 services", "1-minute checks", "90-day history"],
    cta: "Choose Growth",
    featured: true,
  },
  {
    name: "Scale",
    monthlyPrice: 1999,
    note: "For production workloads",
    highlights: ["Priority support", "Custom SLA targets", "30-second checks", "1-year history"],
    cta: "Contact Sales",
    featured: false,
    contactOnly: true,
  },
];

const testimonials = [
  {
    quote: "We reduced response-time incidents by 37% in the first month after switching.",
    by: "N. Verma, Engineering Manager",
  },
  {
    quote: "The dashboard gives leadership a clear reliability view without engineering overhead.",
    by: "A. Roy, CTO",
  },
  {
    quote: "Alert quality is excellent. We spend less time chasing noise and more time fixing root causes.",
    by: "S. Iyer, DevOps Lead",
  },
];

const faqs = [
  {
    q: "How quickly can we go live?",
    a: "Most teams onboard their first endpoints and receive live checks within 10 minutes.",
  },
  {
    q: "Does QoSCollab support SLA reporting?",
    a: "Yes. You can track SLA compliance trends and export data for internal reporting workflows.",
  },
  {
    q: "Can I start free before upgrading?",
    a: "Yes. The Starter plan includes free tokens so you can validate the workflow before scaling.",
  },
];

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: "easeOut" },
  viewport: { once: true, amount: 0.2 },
};

export default function Landing() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [isDemoDialogOpen, setIsDemoDialogOpen] = useState(false);
  const [newsletterLoading, setNewsletterLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoForm, setDemoForm] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });

  const upsertLead = async (payload: {
    email: string;
    lead_type: "newsletter" | "demo_request";
    name?: string;
    company?: string;
    message?: string;
  }) => {
    const { error } = await supabase.from("marketing_leads").upsert(
      {
        ...payload,
        email: payload.email.trim().toLowerCase(),
        source: "landing_page",
      },
      { onConflict: "email,lead_type", ignoreDuplicates: false },
    );
    return error;
  };

  const handleNewsletterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNewsletterLoading(true);
    const error = await upsertLead({
      email: email.trim(),
      lead_type: "newsletter",
    });
    setNewsletterLoading(false);

    if (error) {
      toast({
        title: "Could not subscribe",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Thanks for subscribing",
      description: "We will send product updates and release notes to your inbox.",
    });
    setEmail("");
  };

  const handleDemoSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setDemoLoading(true);

    const error = await upsertLead({
      email: demoForm.email.trim(),
      lead_type: "demo_request",
      name: demoForm.name.trim(),
      company: demoForm.company.trim(),
      message: demoForm.message.trim(),
    });
    setDemoLoading(false);

    if (error) {
      toast({
        title: "Demo request failed",
        description: "Please retry, or email sales@qoscollab.com.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Demo request submitted",
      description: "Our team will contact you shortly.",
    });
    setDemoForm({ name: "", email: "", company: "", message: "" });
    setIsDemoDialogOpen(false);
  };

  const formatPlanPrice = (monthlyPrice: number, contactOnly?: boolean) => {
    if (contactOnly) return "Contact sales";
    if (billingCycle === "annual") {
      const yearly = monthlyPrice * 12;
      const discounted = Math.round(yearly * 0.8);
      return `Rs ${new Intl.NumberFormat("en-IN").format(discounted)}`;
    }
    return `Rs ${new Intl.NumberFormat("en-IN").format(monthlyPrice)}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative overflow-hidden border-b border-slate-800/90 bg-[radial-gradient(circle_at_top_right,_#1d4ed8_0%,_#0f172a_42%,_#020617_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:48px_48px] opacity-30" />

        <header className="sticky top-0 z-40 border-b border-slate-800/70 bg-slate-950/70 backdrop-blur">
          <div className="container flex h-16 items-center justify-between gap-2">
            <Link to="/" className="flex items-center gap-2 text-lg font-semibold text-white">
              <BarChart3 className="h-5 w-5 text-cyan-300" />
              QoSCollab
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
              <a href="#features" className="transition hover:text-white">Platform</a>
              <a href="#pricing" className="transition hover:text-white">Pricing</a>
              <a href="#testimonials" className="transition hover:text-white">Customers</a>
              <a href="#faq" className="transition hover:text-white">FAQ</a>
            </nav>
            <div className="flex items-center gap-2">
              <Link to="/auth/login">
                <Button variant="ghost" className="text-slate-100 hover:bg-slate-800 hover:text-white">Login</Button>
              </Link>
              <Link to="/auth/register">
                <Button className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                  Get Started
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-slate-100 md:hidden"
                aria-label="Toggle mobile menu"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
          {mobileMenuOpen ? (
            <div className="border-t border-slate-800 bg-slate-950/95 px-4 py-4 md:hidden">
              <div className="flex flex-col gap-3 text-sm text-slate-200">
                <a href="#features" className="rounded-md px-2 py-1 hover:bg-slate-800/80">Platform</a>
                <a href="#pricing" className="rounded-md px-2 py-1 hover:bg-slate-800/80">Pricing</a>
                <a href="#testimonials" className="rounded-md px-2 py-1 hover:bg-slate-800/80">Customers</a>
                <a href="#faq" className="rounded-md px-2 py-1 hover:bg-slate-800/80">FAQ</a>
                <a href="#contact" className="rounded-md px-2 py-1 hover:bg-slate-800/80">Contact</a>
              </div>
            </div>
          ) : null}
        </header>

        <section className="container relative py-16 md:py-20">
          <motion.div {...reveal} className="mx-auto max-w-5xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-200/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Reliability Platform for Modern Teams
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight text-white md:text-6xl">
              Commercial-Grade Monitoring
              <br />
              Built for Fast-Moving Products
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base text-slate-200 md:text-lg">
              Monitor service health, detect SLA risk early, and give teams one trusted source of truth for QoS performance.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/auth/register">
                <Button size="lg" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                  Start Free Trial
                </Button>
              </Link>
              <Dialog open={isDemoDialogOpen} onOpenChange={setIsDemoDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" variant="outline" className="border-slate-500 bg-slate-900/30 text-white hover:bg-slate-800">
                    Book Live Demo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Book a Live Demo</DialogTitle>
                    <DialogDescription>
                      Share your details and we will reach out with a guided walkthrough.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleDemoSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="demo-name">Full name</Label>
                      <Input
                        id="demo-name"
                        value={demoForm.name}
                        onChange={(e) => setDemoForm((prev) => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="demo-email">Work email</Label>
                      <Input
                        id="demo-email"
                        type="email"
                        value={demoForm.email}
                        onChange={(e) => setDemoForm((prev) => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="demo-company">Company</Label>
                      <Input
                        id="demo-company"
                        value={demoForm.company}
                        onChange={(e) => setDemoForm((prev) => ({ ...prev, company: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="demo-message">What do you want to monitor?</Label>
                      <Textarea
                        id="demo-message"
                        value={demoForm.message}
                        onChange={(e) => setDemoForm((prev) => ({ ...prev, message: e.target.value }))}
                        placeholder="APIs, websites, SLAs, regions, alert channels..."
                        rows={4}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={demoLoading}>
                        {demoLoading ? "Submitting..." : "Request Demo"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-5 text-sm text-slate-200">
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-cyan-300" />No credit card required</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-cyan-300" />Deploy in under 10 minutes</span>
              <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-cyan-300" />Trusted by engineering teams</span>
            </div>
          </motion.div>

          <motion.div {...reveal} className="mx-auto mt-10 max-w-6xl overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/60 p-3 shadow-2xl">
            <img
              src={heroImg}
              alt="QoSCollab product dashboard"
              className="h-[260px] w-full rounded-xl object-cover md:h-[460px]"
              loading="lazy"
            />
          </motion.div>
        </section>
      </div>

      <section className="border-b border-slate-800 bg-slate-900/70">
        <div className="container py-10">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {socialProof.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-700 bg-slate-900 p-5 text-center">
                <p className="text-2xl font-bold text-cyan-200">{item.value}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-7 rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-4">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Trusted Integrations
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm text-slate-200 md:grid-cols-6">
              {integrations.map((tool) => (
                <div key={tool} className="rounded-lg border border-slate-700/70 bg-slate-950/60 px-3 py-2">
                  {tool}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="container py-16 md:py-20">
        <motion.div {...reveal} className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Why Teams Choose QoSCollab</p>
          <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Everything Needed for Reliable Services</h2>
        </motion.div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {featureCards.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div {...reveal} key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <div className="inline-flex rounded-lg bg-cyan-300/10 p-2 text-cyan-300">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-xl font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/60 py-16 md:py-20">
        <div className="container">
          <motion.div {...reveal} className="text-center">
            <h2 className="text-3xl font-semibold text-white md:text-4xl">Operational Value in 3 Steps</h2>
          </motion.div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, idx) => (
              <motion.div {...reveal} key={step.title} className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">Step {idx + 1}</p>
                <p className="mt-3 text-xl font-semibold text-white">{step.title}</p>
                <p className="mt-2 text-sm text-slate-300">{step.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <motion.div {...reveal} className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Use Cases</p>
          <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Built for Teams Who Own Reliability</h2>
        </motion.div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {useCases.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div {...reveal} key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <div className="inline-flex rounded-lg bg-cyan-300/10 p-2 text-cyan-300">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-xl font-semibold text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section id="pricing" className="container py-16 md:py-20">
        <motion.div {...reveal} className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Pricing</p>
          <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Plans That Scale with Your Reliability Goals</h2>
          <div className="mt-6 inline-flex items-center rounded-full border border-slate-700 bg-slate-900 p-1">
            <Button
              type="button"
              size="sm"
              variant={billingCycle === "monthly" ? "default" : "ghost"}
              className={billingCycle === "monthly" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "text-slate-300"}
              onClick={() => setBillingCycle("monthly")}
            >
              Monthly
            </Button>
            <Button
              type="button"
              size="sm"
              variant={billingCycle === "annual" ? "default" : "ghost"}
              className={billingCycle === "annual" ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "text-slate-300"}
              onClick={() => setBillingCycle("annual")}
            >
              Annual
            </Button>
          </div>
          {billingCycle === "annual" ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-300">
              <TrendingDown className="h-4 w-4" />
              Save 20% with annual billing
            </p>
          ) : null}
        </motion.div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {pricing.map((plan) => (
            <Card key={plan.name} className={plan.featured ? "border-cyan-300 bg-slate-900 text-slate-100 shadow-xl" : "border-slate-800 bg-slate-900 text-slate-100"}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  {plan.name}
                  {plan.featured ? <span className="rounded-full bg-cyan-300/20 px-3 py-1 text-xs font-semibold text-cyan-200">Popular</span> : null}
                </CardTitle>
                <p className="text-3xl font-bold text-white">
                  {formatPlanPrice(plan.monthlyPrice, plan.contactOnly)}
                  {plan.contactOnly ? null : (
                    <span className="text-base font-medium text-slate-400">
                      /{billingCycle === "annual" ? "year" : "mo"}
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-400">{plan.note}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {plan.highlights.map((line) => (
                  <p key={line} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check className="h-4 w-4 text-cyan-300" />
                    {line}
                  </p>
                ))}
                {plan.contactOnly ? (
                  <Button
                    className="mt-4 w-full"
                    variant="outline"
                    type="button"
                    onClick={() => setIsDemoDialogOpen(true)}
                  >
                    {plan.cta}
                  </Button>
                ) : (
                  <Button className={plan.featured ? "mt-4 w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "mt-4 w-full"} variant={plan.featured ? "default" : "outline"} asChild>
                    <Link to="/auth/register">{plan.cta}</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="testimonials" className="border-y border-slate-800 bg-slate-900/60 py-16 md:py-20">
        <div className="container">
          <motion.div {...reveal} className="text-center">
            <h2 className="text-3xl font-semibold text-white md:text-4xl">What Customers Say</h2>
          </motion.div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {testimonials.map((item) => (
              <motion.div {...reveal} key={item.by} className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
                <div className="mb-3 flex">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm leading-6 text-slate-200">"{item.quote}"</p>
                <p className="mt-4 text-sm font-semibold text-white">{item.by}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="container py-16 md:py-20">
        <motion.div {...reveal} className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold text-white md:text-4xl">Frequently Asked Questions</h2>
        </motion.div>
        <div className="mx-auto mt-8 max-w-4xl space-y-3">
          {faqs.map((item) => (
            <motion.details {...reveal} key={item.q} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <summary className="cursor-pointer font-medium text-white">{item.q}</summary>
              <p className="mt-2 text-sm text-slate-300">{item.a}</p>
            </motion.details>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/60 py-16 md:py-20">
        <div className="container">
          <motion.div {...reveal} className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Why We Stand Out</p>
            <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Everything Buyers Expect from a Mature Platform</h2>
          </motion.div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Globe2, title: "Global Coverage", text: "Run checks from multiple regions and compare latency distribution." },
              { icon: ShieldEllipsis, title: "Secure by Design", text: "Role-based access, audit logs, and scoped monitoring operations." },
              { icon: Workflow, title: "Actionable Workflows", text: "Escalate alerts directly to the tools your teams already use." },
              { icon: Smartphone, title: "Mobile-Friendly UI", text: "Track critical incidents from desktop and mobile without friction." },
              { icon: ScanSearch, title: "SLA Visibility", text: "Monitor compliance trends and share reports with leadership instantly." },
              { icon: Headset, title: "Operational Support", text: "Get priority assistance when incidents impact production workloads." },
              { icon: LifeBuoy, title: "Fast Onboarding", text: "Guided setup and templates reduce time-to-value for every new service." },
              { icon: Zap, title: "Efficient Cost Model", text: "Predictable token usage lets you scale monitoring while controlling spend." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <motion.div {...reveal} key={item.title} className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
                  <Icon className="h-5 w-5 text-cyan-300" />
                  <p className="mt-3 font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-300">{item.text}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <motion.div {...reveal} className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-8 text-center md:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">Ready to Improve Reliability?</p>
          <p className="mt-4 text-3xl font-semibold text-white">Start Monitoring in Minutes</p>
          <p className="mx-auto mt-3 max-w-2xl text-slate-200">
            Get instant visibility into service performance and prevent downtime before it impacts revenue.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/auth/register">
              <Button size="lg" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                Create Free Account
              </Button>
            </Link>
            <Link to="/auth/login">
              <Button size="lg" variant="outline" className="border-slate-600 bg-slate-900/40 text-white hover:bg-slate-800">
                View Dashboard Preview
              </Button>
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-sm text-slate-200">
            <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-cyan-300" />Fast setup</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300" />Secure architecture</span>
            <span className="inline-flex items-center gap-2"><Zap className="h-4 w-4 text-cyan-300" />Actionable insights</span>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="container py-10">
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold text-white">
                <BarChart3 className="h-5 w-5 text-cyan-300" />
                QoSCollab
              </div>
              <p className="mt-3 text-sm text-slate-400">Commercial website and API monitoring platform.</p>
            </div>
            <div>
              <p className="font-semibold text-white">Product</p>
              <a href="#features" className="mt-2 block text-sm text-slate-400 hover:text-white">Platform</a>
              <a href="#pricing" className="block text-sm text-slate-400 hover:text-white">Pricing</a>
              <a href="#faq" className="block text-sm text-slate-400 hover:text-white">FAQ</a>
            </div>
            <div>
              <p className="font-semibold text-white">Company</p>
              <a href="#testimonials" className="mt-2 block text-sm text-slate-400 hover:text-white">Customers</a>
              <a href="#contact" className="block text-sm text-slate-400 hover:text-white">Contact</a>
              <a href="https://github.com/ikekra/qos-saas-prediction" target="_blank" rel="noreferrer" className="block text-sm text-slate-400 hover:text-white">
                GitHub
              </a>
            </div>
            <div id="contact">
              <p className="font-semibold text-white">Stay Updated</p>
              <form onSubmit={handleNewsletterSubmit} className="mt-2 flex gap-2">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Work email"
                  type="email"
                  required
                  className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-400"
                />
                <Button type="submit" disabled={newsletterLoading} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                  {newsletterLoading ? "..." : <Mail className="h-4 w-4" />}
                </Button>
              </form>
              <p className="mt-2 text-xs text-slate-400">
                Need enterprise onboarding? Email{" "}
                <a href="mailto:sales@qoscollab.com" className="text-cyan-300 hover:text-cyan-200">
                  sales@qoscollab.com
                </a>
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-6 text-sm text-slate-400">
            <p>Copyright 2026 QoSCollab. All rights reserved.</p>
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300" />Security-first reliability engineering</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
