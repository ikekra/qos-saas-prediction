import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3,
  Check,
  ChevronRight,
  Mail,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import heroImg from "@/assets/hero-qos-monitoring.jpg";

const DEMO_VIDEO_EMBED_URL = "https://www.youtube.com/embed/jNQXAC9IVRw";

const socialProof = [
  { label: "QoS Tests Run", value: "2,400+" },
  { label: "Users", value: "120+" },
  { label: "Platform Uptime", value: "99.2%" },
  { label: "User Rating", value: "4.8/5" },
];

const painPoints = [
  "My API was down for 2 hours and I had no idea.",
  "I do not know which service is actually slow.",
  "Users complain but dashboards look fine.",
  "I cannot prove SLA compliance clearly.",
  "I still check endpoints manually every morning.",
];

const features = [
  {
    title: "Real-Time QoS Monitoring",
    icon: "Realtime",
    points: [
      "P50 / P90 / P99 latency tracking",
      "Uptime over 24h / 7d / 30d",
      "Error rate split by 4xx / 5xx",
      "Throughput in requests per second",
    ],
  },
  {
    title: "Instant Alerts",
    icon: "Alerts",
    points: [
      "Custom thresholds per service",
      "In-app + email alerts",
      "SLA breach detection",
      "Downtime notifications",
    ],
  },
  {
    title: "Token-Based Testing",
    icon: "Tokens",
    points: [
      "Pay only for what you test",
      "Scheduled tests cost less",
      "Cached results can cost 0 tokens",
      "Failure-aware deduction flow",
    ],
  },
  {
    title: "SLA Compliance Reports",
    icon: "SLA",
    points: [
      "Custom SLA targets per service",
      "Visual compliance score",
      "Historical trends",
      "Export to CSV/PDF-ready formats",
    ],
  },
  {
    title: "Multi-Service Dashboard",
    icon: "Dashboard",
    points: [
      "Green / yellow / red status board",
      "Side-by-side service comparison",
      "Failure heatmap by hour",
      "QoS score per service",
    ],
  },
];

const testimonials = [
  {
    quote: "Finally a simple tool to check if my college project APIs are actually working.",
    by: "Priya S., CS Final Year",
    stars: 5,
  },
  {
    quote: "The token model is great. I pay only for what I actually test.",
    by: "Rahul M., Backend Developer",
    stars: 5,
  },
  {
    quote: "Set up monitoring for 3 APIs in under 5 minutes. Perfect for demos.",
    by: "Arjun K., DevOps Intern",
    stars: 5,
  },
  {
    quote: "A practical lightweight QoS platform for students and early teams.",
    by: "Faculty Reviewer, PICT Pune",
    stars: 4,
  },
];

const faqs = [
  {
    q: "What is a QoS test?",
    a: "A Quality of Service test checks response time, uptime, error rate, and throughput for your service.",
  },
  {
    q: "What is a token?",
    a: "A token is a usage credit. Different test types consume different token amounts.",
  },
  {
    q: "Do unused tokens expire?",
    a: "Plan-cycle tokens reset at cycle boundaries. Top-up packs are intended for longer carry-over usage.",
  },
  {
    q: "Is endpoint data safe?",
    a: "We focus on metadata and QoS outcomes for monitoring. Sensitive handling should follow your production policy controls.",
  },
  {
    q: "Can I monitor private/internal APIs?",
    a: "Current flow is optimized for reachable endpoints. Internal/private network support can be added next.",
  },
  {
    q: "Is this production ready?",
    a: "It is actively evolving and suitable for development, staging, and controlled production workloads.",
  },
];

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: "easeOut" },
  viewport: { once: true },
};

export default function Landing() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    toast({
      title: "Thanks for the feedback interest",
      description: "We received your contact and will reach out soon.",
    });
    setEmail("");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-sky-600" />
            QoSCollab
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
            <a href="#features" className="hover:text-sky-700">Features</a>
            <a href="#pricing" className="hover:text-sky-700">Pricing</a>
            <a href="#docs" className="hover:text-sky-700">Docs</a>
            <a href="#blog" className="hover:text-sky-700">Blog</a>
            <a href="#status" className="hover:text-sky-700">Status</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth/login">
              <Button variant="ghost" className="text-slate-700">Login</Button>
            </Link>
            <Link to="/auth/register">
              <Button className="bg-sky-600 hover:bg-sky-500">
                Get Started
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="container py-14 md:py-20">
        <motion.div {...reveal} className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-1 text-xs font-semibold text-sky-700">
            <Sparkles className="h-3.5 w-3.5" />
            Built by Students • Open to Feedback
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">
            Monitor, Analyse and Improve
            <br />
            Your Web Services Quality.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 md:text-lg">
            Know exactly when your APIs slow down, fail, or breach SLA targets.
            Get instant alerts and fix issues before users notice.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth/register">
              <Button size="lg" className="bg-sky-600 hover:bg-sky-500">
                Start Free — 500 Tokens
              </Button>
            </Link>
            <a href="#demo">
              <Button size="lg" variant="outline">
                Watch Demo (2 min)
              </Button>
            </a>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1"><Check className="h-4 w-4 text-emerald-600" />No credit card required</span>
            <span className="inline-flex items-center gap-1"><Check className="h-4 w-4 text-emerald-600" />Free tier available</span>
            <span className="inline-flex items-center gap-1"><Check className="h-4 w-4 text-emerald-600" />Setup in under 2 minutes</span>
          </div>
        </motion.div>

        <motion.div {...reveal} className="mx-auto mt-10 max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <img
            src={heroImg}
            alt="QoSCollab dashboard screenshot"
            className="h-[260px] w-full rounded-xl object-cover md:h-[420px]"
            loading="lazy"
          />
        </motion.div>
      </section>

      <section id="demo" className="container pb-12 md:pb-16">
        <motion.div {...reveal} className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="aspect-video overflow-hidden rounded-xl">
            <iframe
              className="h-full w-full"
              src={DEMO_VIDEO_EMBED_URL}
              title="QoSCollab demo video"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </motion.div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="container py-8">
          <p className="text-center text-sm text-slate-500">Trusted by developers, student teams and project mentors</p>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
            {socialProof.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-2xl font-semibold text-slate-900">{item.value}</p>
                <p className="mt-1 text-xs text-slate-600">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-10 md:py-12">
        <motion.div
          {...reveal}
          className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Sponsor Support</p>
            <span className="rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Title Sponsor
            </span>
          </div>

          <div className="mt-4 grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-lg font-semibold text-slate-900">
                Supported by ASQUADRA LOOP
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Supporting us since 2024. Their sponsorship helps us keep QoSCollab free for students and open project teams.
              </p>

              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                <li>- Infra and hosting support for production demos</li>
                <li>- CI/CD and deployment pipeline reliability</li>
                <li>- Continuous improvements for realtime QoS and token workflows</li>
              </ul>

              <blockquote className="mt-3 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-sm italic text-slate-700">
                "We support QoSCollab because practical student-built reliability tools deserve real-world backing."
              </blockquote>

              <p className="mt-3 text-xs text-slate-600">
                Sponsor note: sponsorship keeps this project free and open while preserving independent product decisions.
              </p>
            </div>

            <div className="text-left md:text-right">
              <a
                href="https://asquadraloop.in/?utm_source=qoscollab&utm_medium=website&utm_campaign=sponsor_section"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-white px-5 py-4 text-center text-base font-semibold text-sky-700 shadow-sm hover:border-sky-300 hover:text-sky-600"
              >
                Visit Sponsor Site
              </a>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600 md:justify-end">
                <a href="https://www.linkedin.com/company/asquadraloop/" target="_blank" rel="noreferrer" className="hover:text-sky-700">
                  LinkedIn
                </a>
                <a href="https://x.com/asquadraloop" target="_blank" rel="noreferrer" className="hover:text-sky-700">
                  X
                </a>
                <a href="https://github.com/asquadraloop" target="_blank" rel="noreferrer" className="hover:text-sky-700">
                  GitHub
                </a>
              </div>
              <div className="mt-4">
                <a href="https://github.com/sponsors" target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">Become a Sponsor</Button>
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="container py-16 md:py-20">
        <motion.div {...reveal} className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-semibold md:text-4xl">Sound familiar?</h2>
          <div className="mt-8 grid gap-3">
            {painPoints.map((item) => (
              <div key={item} className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-rose-900">
                😤 {item}
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-lg font-medium text-sky-700">There is a better way.</p>
        </motion.div>
      </section>

      <section id="features" className="bg-white py-16 md:py-20">
        <div className="container space-y-10">
          {features.map((feature, index) => (
            <motion.div {...reveal} key={feature.title} className="grid items-center gap-6 rounded-2xl border border-slate-200 p-4 md:grid-cols-2 md:p-6">
              <div className={index % 2 === 0 ? "order-1" : "order-1 md:order-2"}>
                <img
                  src={heroImg}
                  alt={`${feature.title} preview`}
                  className="h-64 w-full rounded-xl object-cover shadow-md"
                  loading="lazy"
                />
              </div>
              <div className={index % 2 === 0 ? "order-2" : "order-2 md:order-1"}>
                <p className="text-xl font-semibold">{feature.icon} {feature.title}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {feature.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <motion.div {...reveal} className="text-center">
          <h2 className="text-3xl font-semibold md:text-4xl">How it works in 3 steps</h2>
        </motion.div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { title: "Add Services", icon: "Link", text: "Paste endpoint URL and save your service." },
            { title: "Configure Tests", icon: "Setup", text: "Choose test type, interval, and SLA target." },
            { title: "Monitor & Alert", icon: "Track", text: "Track live metrics and get instant alerts." },
          ].map((step, idx) => (
            <motion.div {...reveal} key={step.title} className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold text-slate-500">STEP {idx + 1}</p>
              <p className="mt-2 text-xl font-semibold">{step.icon} {step.title}</p>
              <p className="mt-2 text-sm text-slate-600">{step.text}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link to="/auth/register">
            <Button size="lg" className="bg-sky-600 hover:bg-sky-500">Start Monitoring Free</Button>
          </Link>
        </div>
      </section>

      <section id="pricing" className="bg-white py-16 md:py-20">
        <div className="container">
          <motion.div {...reveal} className="text-center">
            <h2 className="text-3xl font-semibold md:text-4xl">Simple pricing. No surprises.</h2>
          </motion.div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Free</CardTitle>
                <p className="text-3xl font-bold">Rs 0/mo</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>5,000 tokens</p><p>5 services</p><p>5-min checks</p><p>Email alerts</p><p>7-day history</p>
                <Button className="mt-4 w-full" variant="outline" asChild><Link to="/auth/register">Start Free</Link></Button>
              </CardContent>
            </Card>
            <Card className="border-sky-300 shadow-lg">
              <CardHeader>
                <CardTitle>Pro ⭐ Popular</CardTitle>
                <p className="text-3xl font-bold">Rs 499/mo</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>50,000 tokens</p><p>25 services</p><p>1-min checks</p><p>All alerts</p><p>90-day history</p>
                <Button className="mt-4 w-full bg-sky-600 hover:bg-sky-500" asChild><Link to="/auth/register">Get Pro</Link></Button>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Enterprise</CardTitle>
                <p className="text-3xl font-bold">Rs 1,999/mo</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>Unlimited services</p><p>30-sec checks</p><p>Custom SLA</p><p>1-year history</p><p>Dedicated support</p>
                <Button className="mt-4 w-full" variant="outline">Contact Us</Button>
              </CardContent>
            </Card>
          </div>
          <p className="mt-6 text-center text-sm text-slate-600">
            Token packs: 5,000 @ Rs 199 • 15,000 @ Rs 499 • 50,000 @ Rs 1,499
          </p>
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <motion.div {...reveal} className="text-center">
          <h2 className="text-3xl font-semibold md:text-4xl">What early users are saying</h2>
        </motion.div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {testimonials.map((item) => (
            <motion.div {...reveal} key={item.by} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-2 flex">
                {Array.from({ length: item.stars }).map((_, idx) => (
                  <Star key={idx} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-slate-700">"{item.quote}"</p>
              <p className="mt-3 text-sm font-medium text-slate-900">{item.by}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="container py-10">
          <div className="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
            {socialProof.map((item) => (
              <div key={`bar-${item.label}`}>
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-sm text-slate-600">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-16 md:py-20">
        <motion.div {...reveal} className="rounded-3xl border border-sky-200 bg-sky-50 p-8">
          <p className="text-xl font-semibold">Built with purpose. Open to feedback.</p>
          <p className="mt-3 max-w-3xl text-slate-700">
            This platform is built to solve real QoS monitoring problems without enterprise complexity or pricing.
            We actively improve based on user feedback.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="outline" className="bg-white"><Mail className="mr-2 h-4 w-4" />Give Feedback</Button>
            <Button variant="outline" className="bg-white">Report a Bug</Button>
            <a href="https://github.com/ikekra/qos-saas-prediction" target="_blank" rel="noreferrer">
              <Button variant="outline" className="bg-white">Star on GitHub</Button>
            </a>
            <Button variant="outline" className="bg-white">Read Our Paper</Button>
          </div>
        </motion.div>
      </section>

      <section id="faq" className="bg-white py-16 md:py-20">
        <div className="container max-w-4xl">
          <motion.div {...reveal} className="text-center">
            <h2 className="text-3xl font-semibold md:text-4xl">Frequently Asked Questions</h2>
          </motion.div>
          <div className="mt-8 space-y-3">
            {faqs.map((item) => (
              <motion.details {...reveal} key={item.q} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer font-medium text-slate-900">{item.q}</summary>
                <p className="mt-2 text-sm text-slate-700">{item.a}</p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      <section id="docs" className="container py-16 md:py-20">
        <motion.div {...reveal} className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Docs</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Product setup, service onboarding, and QoS test usage guide.
            </CardContent>
          </Card>
          <Card id="blog">
            <CardHeader>
              <CardTitle>Blog</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Product updates, roadmap notes, and implementation stories.
            </CardContent>
          </Card>
          <Card id="status">
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Current platform health and uptime visibility for users.
            </CardContent>
          </Card>
        </motion.div>
      </section>

      <section className="container py-16 md:py-20">
        <motion.div {...reveal} className="rounded-3xl bg-slate-900 p-8 text-center text-white md:p-12">
          <p className="text-3xl font-semibold">Stop guessing. Start knowing.</p>
          <p className="mx-auto mt-3 max-w-2xl text-slate-300">
            Your services are either performing well or not. Find out in 2 minutes.
          </p>
          <div className="mt-6">
            <Link to="/auth/register">
              <Button size="lg" className="bg-sky-600 hover:bg-sky-500">
                Start Free — 500 Tokens Included
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-300">No card • Free tier • Setup in 2 min • Cancel anytime</p>
        </motion.div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="container py-10">
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <BarChart3 className="h-5 w-5 text-sky-600" />
                QoSCollab
              </div>
              <p className="mt-3 text-sm text-slate-600">Monitor web service quality with confidence.</p>
            </div>
            <div>
              <p className="font-semibold">Product</p>
              <a href="#features" className="mt-2 block text-sm text-slate-600 hover:text-sky-700">Features</a>
              <a href="#pricing" className="block text-sm text-slate-600 hover:text-sky-700">Pricing</a>
              <a href="#docs" className="block text-sm text-slate-600 hover:text-sky-700">Docs</a>
            </div>
            <div>
              <p className="font-semibold">Company</p>
              <a href="#blog" className="mt-2 block text-sm text-slate-600 hover:text-sky-700">Blog</a>
              <a href="#status" className="block text-sm text-slate-600 hover:text-sky-700">Status</a>
              <a
                href="https://github.com/ikekra/qos-saas-prediction"
                target="_blank"
                rel="noreferrer"
                className="block text-sm text-slate-600 hover:text-sky-700"
              >
                GitHub
              </a>
            </div>
            <div>
              <p className="font-semibold">Legal</p>
              <p className="mt-2 text-sm text-slate-600">Privacy</p>
              <p className="text-sm text-slate-600">Terms</p>
              <p className="text-sm text-slate-600">Cookie Policy</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6 text-sm text-slate-600">
            <p>Built by student team • (c) 2026 QoSCollab</p>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4 text-emerald-600" />Secure-by-design direction</span>
          </div>
          <form onSubmit={handleSubmit} className="mt-6 flex max-w-md gap-2">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Share your email for updates"
              type="email"
              required
            />
            <Button type="submit">Notify</Button>
          </form>
        </div>
      </footer>
    </div>
  );
}
