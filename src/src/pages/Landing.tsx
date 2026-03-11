
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BarChart3, Clock, Shield, TrendingUp, Users, Zap, ChevronRight, CheckCircle, Github, Linkedin, Mail, Activity, Globe, Cpu, Star, Lock, Target, Database, Sparkles, LineChart, FileText, Briefcase, Phone, MapPin, Award, Code, Server, MessageSquare, ArrowRight, Check } from 'lucide-react';
import heroImage from '@/assets/hero-qos-monitoring.jpg';
import testimonial1 from '@/assets/testimonial-1.jpg';
import testimonial2 from '@/assets/testimonial-2.jpg';
import testimonial3 from '@/assets/testimonial-3.jpg';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ScrollableRow } from '@/components/ScrollableRow';
import { ServiceCard } from '@/components/ServiceCard';
import { ThemeToggle } from '@/components/ThemeToggle';

// Mock data for recent services
const recentServices = [
  { id: 1, serviceName: 'api.example.com', latency: 145, uptime: 99.9, status: 'stable' as const, lastTested: '2 mins ago', trend: 'stable' as const },
  { id: 2, serviceName: 'webapp.demo.io', latency: 289, uptime: 98.5, status: 'degrading' as const, lastTested: '5 mins ago', trend: 'up' as const },
  { id: 3, serviceName: 'service.cloud.net', latency: 98, uptime: 99.7, status: 'stable' as const, lastTested: '10 mins ago', trend: 'down' as const },
  { id: 4, serviceName: 'data.platform.com', latency: 567, uptime: 95.2, status: 'critical' as const, lastTested: '15 mins ago', trend: 'up' as const },
  { id: 5, serviceName: 'auth.service.io', latency: 112, uptime: 99.5, status: 'stable' as const, lastTested: '20 mins ago', trend: 'stable' as const },
];

const topPerformers = [
  { id: 6, serviceName: 'cdn.fast.net', latency: 45, uptime: 99.99, status: 'stable' as const, lastTested: '1 min ago', trend: 'down' as const },
  { id: 7, serviceName: 'cache.speed.io', latency: 67, uptime: 99.95, status: 'stable' as const, lastTested: '3 mins ago', trend: 'stable' as const },
  { id: 8, serviceName: 'edge.compute.com', latency: 78, uptime: 99.92, status: 'stable' as const, lastTested: '7 mins ago', trend: 'down' as const },
  { id: 9, serviceName: 'api.blazing.dev', latency: 89, uptime: 99.88, status: 'stable' as const, lastTested: '12 mins ago', trend: 'stable' as const },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};
const cardColors = [
  'from-purple-500/20 to-pink-500/20',
  'from-blue-500/20 to-cyan-500/20',
  'from-green-500/20 to-emerald-500/20',
  'from-orange-500/20 to-red-500/20',
  'from-indigo-500/20 to-purple-500/20',
  'from-rose-500/20 to-pink-500/20',
  'from-yellow-500/20 to-orange-500/20',
  'from-teal-500/20 to-green-500/20',
  'from-fuchsia-500/20 to-purple-500/20',
  'from-lime-500/20 to-emerald-500/20',
];


const cardHover = {
  rest: { scale: 1 },
  hover: { 
    scale: 1.05,
    transition: { duration: 0.3 }
  },
  tap: { 
    scale: 0.98,
    transition: { duration: 0.1 }
  }
};

export default function Landing() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [clickedCards, setClickedCards] = useState<Set<string>>(new Set());

  const handleCardClick = (cardId: string) => {
    setClickedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const handleBetaSignup = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Thanks for your interest!",
      description: "We'll contact you soon about early access.",
    });
    setEmail('');
    setName('');
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Message Sent!",
      description: "We'll get back to you within 24 hours.",
    });
    setContactForm({ name: '', email: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <motion.nav 
        className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-glass shadow-soft"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
            >
              <BarChart3 className="h-6 w-6 text-primary" />
            </motion.div>
            <span className="text-xl font-bold">QoSCollab</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/auth/login">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="ghost">Login</Button>
              </motion.div>
            </Link>
            <Link to="/auth/register">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button className="shadow-soft">Get Started</Button>
              </motion.div>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section - Netflix Style */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Animated gradient background */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-cyan-900/20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(120,119,198,0.3),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(74,222,128,0.2),transparent_50%)]" />
        </div>
        <div className="absolute inset-0 z-0">
          <img
            src={heroImage}
            alt="QoS Monitoring"
            className="h-full w-full object-cover mix-blend-overlay opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent" />
        </div>
        {/* Animated floating orbs */}
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
        <div className="container relative z-10 py-24">
          <motion.div
            className="max-w-2xl space-y-8"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/20"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              whileHover={{ scale: 1.05 }}
            >
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI-Powered Performance Intelligence</span>
            </motion.div>
            
            <motion.h1
              className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              QoSCollab — AI-Powered{' '}
              <span className="bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
                Performance Intelligence
              </span>
              {' '}for Modern Web Services
            </motion.h1>
            
            <motion.p
              className="text-xl text-muted-foreground leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Monitor, analyze, and optimize the reliability of your APIs, CDNs, and microservices with intelligent insights driven by real-time data and AI factorization models.
            </motion.p>
            
            <motion.div
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <Link to="/auth/register">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="lg" className="gap-2 shadow-glow text-lg px-8 h-14">
                    Get Started Free <ChevronRight className="h-5 w-5" />
                  </Button>
                </motion.div>
              </Link>
              <Link to="/auth/login">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="lg" variant="outline" className="text-lg px-8 h-14 backdrop-blur-sm">
                    View Dashboard Demo
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            {/* Trust Badges */}
            <motion.div
              className="flex flex-wrap gap-6 pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              {[
                { icon: Shield, text: 'Secure Platform' },
                { icon: Globe, text: '24/7 Monitoring' },
                { icon: Cpu, text: 'AI-Driven Insights' }
              ].map((badge, index) => (
                <motion.div
                  key={badge.text}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 + index * 0.1 }}
                  whileHover={{ scale: 1.1 }}
                >
                  <badge.icon className="h-4 w-4 text-primary" />
                  <span>{badge.text}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Recent Services - Enhanced Style Row */}
<section className="container py-16 relative">
  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 blur-3xl" />

  <ScrollableRow title="Recently Tested Services">
    {recentServices.map((service) => (
      <motion.div
        key={service.id}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.97 }}
        className="transition-all duration-300 hover:brightness-110"
      >
        <ServiceCard {...service} />
      </motion.div>
    ))}
  </ScrollableRow>
</section>


{/* Top Performers Row - Enhanced */}
<section className="container py-8 relative">
  <div className="absolute inset-0 bg-gradient-to-l from-green-500/5 via-emerald-500/5 to-teal-500/5 blur-3xl" />

  <ScrollableRow title="Top Performers">
    {topPerformers.map((service) => (
      <motion.div
        key={service.id}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.97 }}
        className="hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-300"
      >
        <ServiceCard {...service} />
      </motion.div>
    ))}
  </ScrollableRow>
</section>



{/* Product Section - Turbo Enhanced */}
<section id="product" className="container py-24 relative overflow-hidden">
  {/* Animated Grid Background */}
  <div className="absolute inset-0 w-full left-0 right-0 overflow-hidden">
  {/* Full-width gradient base */}
  <div className="absolute inset-0 w-full bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-pink-500/10" />

  {/* FIXED GRID BACKGROUND - NO SIDE GAP */}
  <motion.div
    className="absolute inset-0 w-full h-full"
    animate={{ backgroundPosition: ['0% 0%', '120% 120%'] }}
    transition={{ duration: 20, repeat: Infinity, repeatType: "reverse" }}
    style={{
      backgroundImage:
        'radial-gradient(circle, rgba(139,92,246,0.10) 1px, transparent 1px)',
      backgroundSize: '45px 45px',      // tighter so it fills without gaps
      backgroundRepeat: 'repeat',       // ensures full fill
    }}
  />
</div>


  {/* Header */}
  <motion.div
    className="mx-auto max-w-3xl text-center space-y-6 mb-16 relative z-10"
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6 }}
  >
    <motion.h2
      className="text-4xl font-bold"
      initial={{ scale: 0.9 }}
      whileInView={{ scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      Smarter Web Service Optimization
    </motion.h2>

    <p className="text-xl text-muted-foreground">
      QoSCollab is an intelligent performance analysis platform designed for developers & organizations to monitor, benchmark and enhance service quality.
    </p>
  </motion.div>


  {/* Product Feature Cards */}
  <motion.div
    className="grid gap-8 md:grid-cols-3 relative z-10"
    variants={staggerContainer}
    initial="initial"
    whileInView="animate"
    viewport={{ once: true }}
  >
    {[
      { icon: Database, title: 'Comprehensive Metrics', desc: 'Real-time tracking of latency, throughput, error rates, and uptime with analytics.', id: 'product-1' },
      { icon: Sparkles, title: 'AI Insights', desc: 'Factorization and ML models detect hidden bottlenecks and correlations instantly.', id: 'product-2' },
      { icon: Activity, title: 'Continuous Monitoring', desc: 'Automated performance testing runs periodically and alerts you early.', id: 'product-3' }
    ].map((item) => (
      <motion.div
        key={item.id}
        variants={fadeInUp}
        whileHover={{ scale: 1.07, y: -6 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => handleCardClick(item.id)}
        className="cursor-pointer"
      >
        <Card
          className={`border border-border/50 h-full transition-all duration-500 rounded-xl shadow-md
            hover:shadow-primary/40 hover:border-primary
            hover:bg-gradient-to-br hover:from-primary/20 hover:via-purple-500/10 hover:to-pink-500/10
            ${clickedCards.has(item.id) ? 'bg-gradient-to-br from-primary/20 via-purple-400/10 to-pink-500/10 border-primary shadow-xl' : ''}`}
        >
          <CardHeader>
            <motion.div
              className="rounded-lg bg-primary/10 w-fit p-4 mb-4"
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.6 }}
            >
              <item.icon className="h-8 w-8 text-primary" />
            </motion.div>

            <CardTitle className="text-xl font-semibold">{item.title}</CardTitle>
          </CardHeader>

          <CardContent className="text-muted-foreground leading-relaxed">
            {item.desc}
          </CardContent>
        </Card>
      </motion.div>
    ))}
  </motion.div>
</section>


      {/* Dashboard Section */}
      <section id="dashboard" className="py-24 relative overflow-hidden">
        {/* Animated mesh gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-purple-900/30 to-slate-900/50" />
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "linear"
          }}
          style={{
            backgroundImage: 'linear-gradient(45deg, #667eea 25%, transparent 25%, transparent 75%, #764ba2 75%, #764ba2), linear-gradient(45deg, #667eea 25%, transparent 25%, transparent 75%, #764ba2 75%, #764ba2)',
            backgroundSize: '60px 60px',
            backgroundPosition: '0 0, 30px 30px'
          }}
        />
        {/* Floating particles */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-primary/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.5, 1]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
        <div className="container relative z-10">
          <motion.div
            className="mx-auto max-w-3xl text-center space-y-6 mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl font-bold">Your Command Center for Service Performance</h2>
            <p className="text-xl text-muted-foreground">
              Visualize and compare key performance metrics in one unified dashboard.
            </p>
          </motion.div>

          <motion.div
            className="grid gap-8 md:grid-cols-2"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {[
              { icon: LineChart, title: 'Live Performance Metrics', desc: 'Monitor latency, throughput, and error rates in real-time with interactive charts.', id: 'dash-1' },
              { icon: Target, title: 'Anomaly Detection', desc: 'AI-powered alerts notify you instantly when performance degrades.', id: 'dash-2' },
              { icon: BarChart3, title: 'Comparative Analysis', desc: 'Compare multiple services side-by-side to identify optimization opportunities.', id: 'dash-3' },
              { icon: TrendingUp, title: 'Historical Trends', desc: 'Track performance over time to understand patterns and long-term reliability.', id: 'dash-4' }
            ].map((feature) => (
              <motion.div 
                key={feature.id}
                variants={fadeInUp}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCardClick(feature.id)}
                className="cursor-pointer"
              >
                <Card className={`netflix-card border-border/50 h-full transition-all duration-300 ${
                  clickedCards.has(feature.id) 
                    ? 'bg-gradient-to-br from-blue-500/20 via-cyan-500/10 to-teal-500/10 border-blue-400 shadow-glow' 
                    : ''
                }`}>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <motion.div 
                        className="rounded-lg bg-primary/10 p-3"
                        whileHover={{ rotate: 180 }}
                        transition={{ duration: 0.4 }}
                      >
                        <feature.icon className="h-6 w-6 text-primary" />
                      </motion.div>
                      <div>
                        <CardTitle className="text-lg mb-2">{feature.title}</CardTitle>
                        <CardDescription className="text-base leading-relaxed">
                          {feature.desc}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            className="mt-12 text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Link to="/auth/login">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg" className="gap-2">
                  Explore Dashboard <ArrowRight className="h-5 w-5" />
                </Button>
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Section - Enhanced UI */}
<section id="features" className="py-24 relative overflow-hidden">
  {/* Animated aurora background */}
  <div className="absolute inset-0 bg-gradient-to-b from-background via-indigo-950/20 to-background" />
  <motion.div
    className="absolute inset-0 opacity-30"
    animate={{
      background: [
        'radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%)',
        'radial-gradient(circle at 80% 50%, rgba(74, 222, 128, 0.3) 0%, transparent 50%)',
        'radial-gradient(circle at 50% 80%, rgba(251, 191, 36, 0.3) 0%, transparent 50%)',
        'radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%)',
      ]
    }}
    transition={{
      duration: 15,
      repeat: Infinity,
      ease: "linear"
    }}
  />

  <div className="container relative z-10">
    <motion.div 
      className="mx-auto max-w-2xl text-center mb-16"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <h2 className="text-4xl font-bold tracking-tight mb-4">Key Features</h2>
      <p className="text-lg text-muted-foreground">
        Everything you need to monitor, test, and optimize your web services
      </p>
    </motion.div>

    {/* Feature Cards */}
    <motion.div 
      className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
      variants={staggerContainer}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true }}
    >
      {[
        { icon: Zap, title: 'Real-time API Testing', desc: 'Execute automated performance tests instantly with detailed metrics', id: 'feat-1' },
        { icon: Sparkles, title: 'AI-Powered Recommendations', desc: 'Get intelligent service suggestions based on your patterns', id: 'feat-2' },
        { icon: BarChart3, title: 'Comparative Analysis', desc: 'Compare multiple services side-by-side with visual benchmarks', id: 'feat-3' },
        { icon: LineChart, title: 'Historical Trends', desc: 'Track performance over time with comprehensive analytics', id: 'feat-4' },
        { icon: Star, title: 'Service Rating System', desc: 'Community-driven ratings help you discover reliable services', id: 'feat-5' },
        { icon: Target, title: 'Personalized Dashboards', desc: 'Customize your view with Netflix-style categories', id: 'feat-6' }
      ].map((feature) => (
        <motion.div
          key={feature.id}
          variants={fadeInUp}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => handleCardClick(feature.id)}
          className="cursor-pointer"
        >
          <Card
            className={`border border-border/50 h-full transition-all duration-500 rounded-xl shadow-md 
              hover:shadow-emerald-500/40 hover:border-emerald-400
              hover:bg-gradient-to-br hover:from-emerald-500/20 hover:via-green-500/10 hover:to-teal-500/10
              ${clickedCards.has(feature.id) ? 'bg-gradient-to-br from-emerald-500/20 via-green-500/10 to-teal-500/10 border-emerald-400 shadow-xl' : ''}`}
          >
            <CardHeader>
              <motion.div
                whileHover={{ scale: 1.2, rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="rounded-lg bg-primary/10 w-fit p-3 mb-4"
              >
                <feature.icon className="h-6 w-6 text-primary" />
              </motion.div>
              <CardTitle className="text-xl font-semibold">{feature.title}</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                {feature.desc}
              </CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  </div>
</section>


      {/* Pricing Section */}
<section id="pricing" className="py-24 relative overflow-hidden">
  {/* Animated grid background */}
  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-blue-900/20" />

  <motion.div
    className="absolute inset-0 opacity-10"
    animate={{ backgroundPosition: ["0px 0px", "60px 60px"] }}
    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
    style={{
      backgroundImage:
        "linear-gradient(rgba(139,92,246,0.5) 2px, transparent 2px), linear-gradient(90deg, rgba(139,92,246,0.5) 2px, transparent 2px)",
      backgroundSize: "60px 60px",
    }}
  />

  <motion.div
    className="absolute top-10 right-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"
    animate={{ scale: [1, 1.5, 1], rotate: [0, 180, 360] }}
    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
  />

  <div className="container relative z-10">
    <motion.div
      className="mx-auto max-w-3xl text-center space-y-6 mb-20"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <h2 className="text-4xl font-bold">Flexible Plans for Every Developer</h2>
      <p className="text-xl text-muted-foreground">
        Choose a plan that scales with your needs — whether you're testing a single API or managing a network of microservices
      </p>
    </motion.div>

    <motion.div
      className="grid gap-10 md:grid-cols-3 max-w-5xl mx-auto"
      variants={staggerContainer}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true }}
    >
      {[
        {
          name: "Free",
          price: "$0",
          period: "forever",
          features: [
            "Basic analytics",
            "5 daily tests",
            "Community access",
            "Performance metrics",
            "Service ratings",
          ],
          cta: "Start Now",
          popular: false,
          id: "price-1",
        },
        {
          name: "Pro",
          price: "$15",
          period: "per month",
          features: [
            "Unlimited tests",
            "AI recommendations",
            "Priority support",
            "Advanced analytics",
            "Historical trends",
            "Export reports",
          ],
          cta: "Start Now",
          popular: true,
          id: "price-2",
        },
        {
          name: "Enterprise",
          price: "Custom",
          period: "contact us",
          features: [
            "Everything in Pro",
            "Team management",
            "Custom integrations",
            "SLA guarantees",
            "Dedicated support",
            "On-premise option",
          ],
          cta: "Request Demo",
          popular: false,
          id: "price-3",
        },
      ].map((plan) => (
        <motion.div
          key={plan.id}
          variants={fadeInUp}
          whileHover={{ y: -10, scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleCardClick(plan.id)}
          className={`cursor-pointer ${
            plan.popular ? "md:scale-[1.05]" : ""
          }`}
        >
          <Card
            className={`netflix-card border-border/50 h-full relative transition-all duration-300 
              ${plan.popular ? "ring-2 ring-primary shadow-glow" : ""}
              ${
                clickedCards.has(plan.id)
                  ? "bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-yellow-500/10 border-amber-400"
                  : ""
              }
              ${plan.popular ? "pt-10 pb-6" : "pt-8 pb-6"} 
            `}
          >
            {plan.popular && (
              <motion.div
                className="absolute -top-5 left-1/2 -translate-x-1/2"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold shadow-md">
                  Most Popular
                </span>
              </motion.div>
            )}

            <CardHeader className="text-center pb-10">
              <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground ml-2">/{plan.period}</span>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 px-6">
              <ul className="space-y-4">
                {plan.features.map((feature) => (
                  <motion.li
                    key={feature}
                    className="flex items-start gap-3"
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                  >
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </motion.li>
                ))}
              </ul>

              <Link to="/auth/register">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </motion.div>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  </div>
</section>

{/* Testimonials - Premium Enhanced */}
<section className="py-24 relative overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-r from-pink-900/10 via-background to-purple-900/10" />

  {/* Sparkle Effect */}
  {[...Array(25)].map((_, i) => (
    <motion.div
      key={i}
      className="absolute w-1.5 h-1.5 bg-white/70 rounded-full shadow-lg"
      style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
      }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0, 1.5, 0],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        delay: Math.random() * 3,
        ease: "easeInOut",
      }}
    />
  ))}

  <div className="container relative z-10">
    <motion.div
      className="mx-auto max-w-2xl text-center mb-20"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <h2 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-rose-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
        Loved by Developers Globally
      </h2>
      <p className="text-lg text-muted-foreground mt-4">
        Hear from teams who trust QoSCollab for industry-grade reliability
      </p>
    </motion.div>

    <motion.div
      className="grid gap-10 md:grid-cols-3"
      variants={staggerContainer}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true }}
    >
      {[
        { img: testimonial1, name: 'Alpha', role: 'Product Manager at TechCorp', quote: 'Improved our API uptime tracking by 40%. The insights are invaluable!', id: 'test-1' },
        { img: testimonial2, name: 'Beta', role: 'Lead Developer at StartupXYZ', quote: 'Best tool for QoS analysis we\'ve found. Simple, fast, and insightful.', id: 'test-2' },
        { img: testimonial3, name: 'Delta', role: 'Director at GlobalTech', quote: 'Helps us maintain 99.9% uptime consistently. Absolutely essential.', id: 'test-3' }
      ].map((testimonial) => (
        <motion.div
          key={testimonial.id}
          variants={fadeInUp}
          whileHover={{ y: -8, scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => handleCardClick(testimonial.id)}
          className="cursor-pointer group"
        >
          <Card
            className={`metric-card border-border/40 transition-all duration-500 rounded-2xl backdrop-blur-xl
              ${clickedCards.has(testimonial.id)
                ? 'bg-gradient-to-br from-rose-500/20 via-pink-500/10 to-fuchsia-500/10 border-rose-400 shadow-[0_0_45px_rgba(244,114,182,0.45)]'
                : 'hover:shadow-[0_0_35px_rgba(244,114,182,0.25)] hover:border-pink-400'
              }
            `}
          >
            <CardHeader className="text-center">
              {/* Image Hover FX */}
              <motion.img
                src={testimonial.img}
                alt={testimonial.name}
                className="w-24 h-24 rounded-full mx-auto mb-4 object-cover ring-4 ring-primary/10 shadow-lg"
                whileHover={{ scale: 1.15, rotate: 4 }}
                transition={{ duration: 0.4 }}
              />

              {/* Animated Stars */}
              <div className="flex justify-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Star className="h-5 w-5 fill-primary text-primary drop-shadow" />
                  </motion.div>
                ))}
              </div>

              <CardDescription className="text-base italic text-muted-foreground mb-4 leading-relaxed">
                "{testimonial.quote}"
              </CardDescription>

              <CardTitle className="text-xl font-semibold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                {testimonial.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{testimonial.role}</p>
            </CardHeader>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  </div>
</section>

{/* Company/About Section */}
<section id="about" className="py-24 relative overflow-hidden">
  {/* Background Gradients */}
  <div className="absolute inset-0 bg-gradient-to-bl from-emerald-900/20 via-background to-teal-900/20" />
  <motion.div
    className="absolute inset-0"
    animate={{
      background: [
        'radial-gradient(circle at 0% 0%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)',
        'radial-gradient(circle at 100% 100%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
        'radial-gradient(circle at 0% 0%, rgba(16, 185, 129, 0.15) 0%, transparent 50%)',
      ]
    }}
    transition={{
      duration: 10,
      repeat: Infinity,
      ease: "easeInOut"
    }}
  />

  <div className="container relative z-10">
    {/* Section Title */}
    <motion.div
      className="mx-auto max-w-3xl text-center space-y-6 mb-16"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <h2 className="text-4xl font-bold">Our Mission</h2>
      <p className="text-xl text-muted-foreground leading-relaxed">
        QoSCollab was founded to redefine how web performance is measured. We blend artificial intelligence with reliability engineering.
      </p>
    </motion.div>

    {/* Stats Cards */}
    <motion.div
      className="grid gap-8 md:grid-cols-3 sm:grid-cols-2 grid-cols-1 max-w-5xl mx-auto"
      variants={staggerContainer}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true }}
    >
      {[
        { icon: Award, title: '2023', desc: 'Founded with a vision to transform performance monitoring', id: 'about-1' },
        { icon: Users, title: '10K+', desc: 'Developers trust QoSCollab for their testing needs', id: 'about-2' },
        { icon: Globe, title: '150+', desc: 'Countries using our platform daily', id: 'about-3' }
      ].map((stat) => (
        <motion.div
          key={stat.id}
          variants={fadeInUp}
          className="cursor-pointer"
          whileHover={{
            scale: 1.05,
            y: -5,
            transition: { duration: 0.3 },
          }}
          whileTap={{ scale: 0.97 }}
        >
          <Card className={`metric-card border border-border/50 text-center h-full transition-all duration-300 hover:shadow-lg hover:shadow-cyan-400/40 hover:bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-indigo-500/10`}>
            <CardHeader>
              <motion.div
                className="rounded-full bg-primary/10 w-16 h-16 flex items-center justify-center mx-auto mb-4"
                whileHover={{ rotate: 360, scale: 1.15 }}
                transition={{ duration: 0.6 }}
              >
                <stat.icon className="h-8 w-8 text-primary" />
              </motion.div>
              <CardTitle className="text-3xl mb-2">{stat.title}</CardTitle>
              <CardDescription className="text-base">{stat.desc}</CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  </div>
</section>



    {/* Blog Section */}
<section id="blog" className="py-24 relative overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-tr from-amber-900/20 via-background to-orange-900/20" />

  {/* Moving Wave Pattern */}
  <motion.div
    className="absolute bottom-0 left-0 right-0 h-32 opacity-25"
    animate={{ backgroundPosition: ['0% 0%', '100% 0%'] }}
    transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
    style={{
      backgroundImage:
        'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'20\' viewBox=\'0 0 100 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 10 Q25 0, 50 10 T100 10\' fill=\'none\' stroke=\'rgba(251,191,36,0.5)\' stroke-width=\'2\'/%3E%3C/svg%3E")',
      backgroundSize: '100px 20px',
      backgroundRepeat: 'repeat-x',
    }}
  />

  <div className="container relative z-10">
    <motion.div
      className="mx-auto max-w-3xl text-center space-y-6 mb-16"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <h2 className="text-4xl font-bold">Insights & Updates</h2>
      <p className="text-xl text-muted-foreground">Stay informed with the latest trends and best practices</p>
    </motion.div>

    <motion.div
      className="grid gap-8 md:grid-cols-3"
      variants={staggerContainer}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true }}
    >
      {[
        {
          title: 'How AI is Transforming API Monitoring',
          preview: 'Discover how machine learning is revolutionizing performance monitoring.',
          icon: Sparkles,
          date: 'Nov 5, 2025',
          id: 'blog-1',
        },
        {
          title: '5 Metrics Every Developer Should Track',
          preview: 'Learn about essential performance indicators for service reliability.',
          icon: BarChart3,
          date: 'Nov 1, 2025',
          id: 'blog-2',
        },
        {
          title: 'Service Comparison Tool Released',
          preview: 'Compare multiple services with our new analytics dashboard.',
          icon: Target,
          date: 'Oct 28, 2025',
          id: 'blog-3',
        },
      ].map((post) => (
        <motion.div
          key={post.id}
          variants={fadeInUp}
          onClick={() => handleCardClick(post.id)}
          className="cursor-pointer"
          whileHover={{ y: -8, scale: 1.05 }}
          transition={{ duration: 0.35 }}
        >
          <Card
            className={`overflow-hidden border border-transparent h-full backdrop-blur-sm transition-all duration-300 rounded-xl
              ${clickedCards.has(post.id)
                ? 'bg-gradient-to-br from-orange-500/20 via-amber-400/10 to-yellow-500/10 border-amber-400 shadow-lg shadow-amber-400/40'
                : 'hover:bg-gradient-to-br hover:from-amber-500/10 hover:via-orange-500/10 hover:to-yellow-500/10 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-400/40'
              }
            `}
          >
            <CardHeader>
              <motion.div
                className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center mb-4"
                whileHover={{ rotate: 360, scale: 1.2 }}
                transition={{ duration: 0.6 }}
              >
                <post.icon className="h-6 w-6 text-primary" />
              </motion.div>
              <div className="text-sm text-muted-foreground mb-2">{post.date}</div>
              <CardTitle className="text-xl mb-3">{post.title}</CardTitle>
              <CardDescription className="text-base leading-relaxed mb-4">{post.preview}</CardDescription>
              <Button variant="ghost" className="gap-2 p-0 h-auto group transition-all">
                Read More
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </CardHeader>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  </div>
</section>


      {/* Careers Section */}
<section id="careers" className="py-24 relative overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-background to-blue-900/20" />

  {/* Floating Hex Grid */}
  <motion.div
    className="absolute inset-0 opacity-10"
    animate={{ backgroundPosition: ['0px 0px', '60px 100px'] }}
    transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
    style={{
      backgroundImage: 'radial-gradient(circle, rgba(59,130,246,0.7) 10%, transparent 12%)',
      backgroundSize: '50px 86px',
    }}
  />

  <div className="container relative z-10">
    <motion.div
      className="mx-auto max-w-3xl text-center space-y-6 mb-16"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <h2 className="text-4xl font-bold">Join the QoSCollab Team</h2>
      <p className="text-xl text-muted-foreground">We're building the next generation of performance intelligence.</p>
    </motion.div>

    <motion.div
      className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto"
      variants={staggerContainer}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true }}
    >
      {[
        {
          title: 'Frontend Developer',
          subtitle: 'React + Tailwind',
          location: 'Phaltan, India',
          type: 'Full-time',
          description: 'Build beautiful, responsive interfaces.',
          icon: Code,
          id: 'career-1',
        },
        {
          title: 'Backend Engineer',
          subtitle: 'Node.js',
          location: 'Remote',
          type: 'Full-time',
          description: 'Design scalable real-time data systems.',
          icon: Server,
          id: 'career-2',
        },
        {
          title: 'Machine Learning Intern',
          subtitle: 'Performance Analytics',
          location: 'Phaltan, India',
          type: 'Internship',
          description: 'Work on AI-powered prediction models.',
          icon: Sparkles,
          id: 'career-3',
        },
      ].map((job) => (
        <motion.div
          key={job.id}
          variants={fadeInUp}
          onClick={() => handleCardClick(job.id)}
          className="cursor-pointer"
          whileHover={{ y: -10, scale: 1.06 }}
          transition={{ duration: 0.33 }}
        >
          <Card
            className={`overflow-hidden border border-transparent h-full transition-all duration-300 rounded-xl
              ${clickedCards.has(job.id)
                ? 'bg-gradient-to-br from-sky-500/20 via-blue-500/10 to-cyan-500/10 border-sky-400 shadow-lg shadow-sky-400/40'
                : 'hover:bg-gradient-to-br hover:from-sky-500/10 hover:via-blue-500/10 hover:to-cyan-500/10 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-400/40'
              }
            `}
          >
            <CardHeader>
              <motion.div
                className="rounded-lg bg-primary/10 w-12 h-12 flex items-center justify-center mb-4"
                whileHover={{ scale: 1.25, rotate: 180 }}
                transition={{ duration: 0.4 }}
              >
                <job.icon className="h-6 w-6 text-primary" />
              </motion.div>
              <CardTitle className="text-xl mb-1">{job.title}</CardTitle>
              <div className="text-sm text-primary mb-4">{job.subtitle}</div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground">{job.type}</span>
                <span className="text-xs px-3 py-1 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {job.location}
                </span>
              </div>
              <CardDescription className="text-base leading-relaxed mb-4">{job.description}</CardDescription>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button className="w-full gap-2">
                  Apply Now <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            </CardHeader>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  </div>
</section>


      {/* Contact Section */}
<section id="contact" className="py-24 relative overflow-hidden">
  {/* Background */}
  <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 via-background to-fuchsia-900/20" />

  {/* Pulsing Rings */}
  <motion.div
    className="absolute top-1/2 left-1/4 w-96 h-96 border border-primary/20 rounded-full"
    animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
    transition={{ duration: 4, repeat: Infinity, ease: "easeOut" }}
  />
  <motion.div
    className="absolute bottom-1/4 right-1/4 w-72 h-72 border border-accent/20 rounded-full"
    animate={{ scale: [1, 2.5, 1], opacity: [0.5, 0, 0.5] }}
    transition={{ duration: 5, repeat: Infinity, ease: "easeOut", delay: 1 }}
  />

  <div className="container relative z-10">
    <motion.div
      className="mx-auto max-w-3xl text-center space-y-6 mb-16"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-pink-500 to-fuchsia-500 bg-clip-text text-transparent">
        Let's Collaborate
      </h2>
      <p className="text-xl text-muted-foreground">
        Have questions or want to integrate QoSCollab? Reach out anytime.
      </p>
    </motion.div>

    <div className="grid gap-12 lg:grid-cols-2 max-w-5xl mx-auto">

      {/* Left Form Card */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Card className="metric-card border-border/50 h-full transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:border-fuchsia-400">
          <CardHeader>
            <CardTitle className="text-2xl mb-6">Send us a Message</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  type="text"
                  placeholder="Your name"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  required
                  className="transition-all hover:border-pink-400 focus:ring-pink-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="your@email.com"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  required
                  className="transition-all hover:border-pink-400 focus:ring-pink-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  placeholder="Tell us about your needs..."
                  rows={5}
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  required
                  className="transition-all hover:border-pink-400 focus:ring-pink-400"
                />
              </div>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Button size="lg" type="submit" className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:opacity-90">
                  Send Message
                </Button>
              </motion.div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Right Contact Info */}
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-6"
      >
        {[
          { icon: Mail, title: 'Email', desc: 'supp@qoscollab.in', id: 'contact-1' },
          { icon: Phone, title: 'Phone', desc: '+91 9175318745', id: 'contact-2' },
          { icon: MapPin, title: 'Office', desc: 'Kolhapur, India', id: 'contact-3' }
        ].map((contact) => (
          <motion.div
            key={contact.id}
            whileHover={{ scale: 1.05, x: 8 }}
            whileTap={{ scale: 0.97 }}
            className="cursor-pointer group"
            onClick={() => handleCardClick(contact.id)}
          >
            <Card className={`metric-card border-border/50 transition-all duration-300 group-hover:shadow-[0_0_25px_rgba(244,63,94,0.4)] group-hover:border-fuchsia-400 ${
              clickedCards.has(contact.id)
                ? 'bg-gradient-to-br from-fuchsia-600/20 via-pink-500/10 to-rose-500/10 shadow-glow'
                : ''
            }`}>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <motion.div
                    className="rounded-lg p-3 bg-primary/10"
                    whileHover={{ rotate: 360, scale: 1.15 }}
                    transition={{ duration: 0.5 }}
                  >
                    <contact.icon className="h-6 w-6 text-primary" />
                  </motion.div>

                  <div>
                    <CardTitle className="text-lg mb-2 group-hover:text-fuchsia-400 transition-colors">
                      {contact.title}
                    </CardTitle>
                    <CardDescription className="text-base">
                      {contact.desc}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </div>
</section>


     {/* Join Beta - Premium Enhanced */}
<section
  className="py-24 bg-cover bg-center bg-no-repeat relative"
  style={{ backgroundImage: "url('/public/1.png')" }}
>
  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" /> {/* Overlay */}
  <div className="container relative z-10">
    <motion.div
      className="mx-auto max-w-2xl"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <motion.div
        whileHover={{ scale: 1.03 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Card className="metric-card shadow-[0_0_35px_rgba(236,72,153,0.25)] hover:shadow-[0_0_55px_rgba(236,72,153,0.45)] transition-all border-border/40 backdrop-blur-xl bg-white/10 hover:bg-white/20">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-4xl font-bold mb-2 tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Join Early Access
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Be the first to experience new features and shape the future of QoSCollab
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleBetaSignup} className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-lg">Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="transition-all border border-transparent hover:border-pink-400 focus:border-pink-500 focus:ring-pink-500"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-lg">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="transition-all border border-transparent hover:border-pink-400 focus:border-pink-500 focus:ring-pink-500"
                />
              </div>

              {/* Button */}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-fuchsia-600 hover:to-pink-500 text-white shadow-lg transition-all"
                >
                  Request Early Access
                </Button>
              </motion.div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  </div>
</section>


{/* Sponsor Section - Quadraloop */}
<section
  id="sponsor"
  className="w-full py-24 bg-gradient-to-br from-sky-50 via-white to-sky-100 text-gray-900"
>
  <div className="container mx-auto px-6">

    {/* Title */}
    <h2 className="text-4xl font-extrabold text-center mb-6 tracking-tight bg-gradient-to-r from-sky-600 to-blue-500 bg-clip-text text-transparent">
      Premium Sponsor – QUADRALOOP
    </h2>

    <p className="text-center text-base md:text-lg max-w-3xl mx-auto mb-16 text-gray-600">
      Empowering industries with AI-driven cloud systems, enterprise automation,
      and intelligent IoT infrastructure that redefines efficiency.
    </p>

    {/* Cards Wrapper */}
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">

      {/* Card */}
      <div className="group border border-sky-200 bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-md 
                      transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 hover:bg-sky-50 hover:border-sky-400">
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          🏢 About Quadraloop
        </h3>
        <p className="text-sm leading-relaxed text-gray-600">
          Quadraloop builds CPUs, enterprise software, and IoT hardware focused
          on reliability, intelligence, and seamless technological interaction.
        </p>
      </div>

      <div className="group border border-sky-200 bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-md 
                      transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 hover:bg-sky-50 hover:border-sky-400">
        <h3 className="text-xl font-semibold mb-3">🔧 Services</h3>
        <ul className="list-disc pl-6 space-y-1 text-sm text-gray-600">
          <li>IoT Development & Consulting</li>
          <li>AI & Cloud Integration</li>
          <li>Custom Hardware Solutions</li>
          <li>Digital Enterprise Transformation</li>
        </ul>
      </div>

      <div className="group border border-sky-200 bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-md 
                      transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 hover:bg-sky-50 hover:border-sky-400">
        <h3 className="text-xl font-semibold mb-3">📦 Products</h3>
        <p className="text-sm text-gray-600">
          Intelligent dashboards, AI engines, and hybrid cloud solutions
          powering next-gen digital infrastructure for enterprises.
        </p>
      </div>

      <div className="group border border-sky-200 bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-md 
                      transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 hover:bg-sky-50 hover:border-sky-400">
        <h3 className="text-xl font-semibold mb-3">🔐 Access Portal</h3>
        <p className="text-sm text-gray-600 mb-4">
          Manage services, project dashboards, and deployments with unified access.
        </p>
        <a
          href="https://quadraloop.com/login"
          target="_blank"
          className="block w-full text-center text-sm py-3 font-medium rounded-xl border border-sky-500 text-sky-700 hover:bg-sky-600 hover:text-white transition-all"
        >
          Go to Login →
        </a>
      </div>

      <div className="group border border-sky-200 bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-md 
                      transition-all duration-300 transform hover:-translate-y-2 hover:scale-105 hover:bg-sky-50 hover:border-sky-400">
        <h3 className="text-xl font-semibold mb-3">📞 Contact</h3>
        <p className="text-sm text-gray-600">
          For integration, enterprise queries, or collaboration:
        </p>
        <p className="mt-3 font-semibold text-sky-700 text-sm">
          support@quadraloop.in
        </p>
      </div>

    </div>
  </div>
</section>


      {/* Footer with Legal Info */}
      <footer id="legal" className="border-t bg-muted/50 py-12">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold">QoSCollab</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered performance intelligence for modern web services
              </p>
              <div className="flex gap-3">
                <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Github className="h-4 w-4" />
                  </Button>
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Linkedin className="h-4 w-4" />
                  </Button>
                </a>
                <a href="mailto:support@qoscollab.ai">
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Mail className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#product" className="text-muted-foreground hover:text-primary transition-colors">Product</a></li>
                <li><Link to="/auth/register" className="text-muted-foreground hover:text-primary transition-colors">Get Started</Link></li>
                <li><Link to="/auth/login" className="text-muted-foreground hover:text-primary transition-colors">Dashboard</Link></li>
                <li><a href="#features" className="text-muted-foreground hover:text-primary transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-muted-foreground hover:text-primary transition-colors">Pricing</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#about" className="text-muted-foreground hover:text-primary transition-colors">About</a></li>
                <li><a href="#blog" className="text-muted-foreground hover:text-primary transition-colors">Blog</a></li>
                <li><a href="#careers" className="text-muted-foreground hover:text-primary transition-colors">Careers</a></li>
                <li><a href="#contact" className="text-muted-foreground hover:text-primary transition-colors">Contact</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-3 text-sm">
                <li>
                  <div className="space-y-1">
                    <a href="#legal" className="text-muted-foreground hover:text-primary transition-colors font-medium block">Privacy Policy</a>
                    <p className="text-xs text-muted-foreground">Your data is encrypted and handled securely</p>
                  </div>
                </li>
                <li>
                  <div className="space-y-1">
                    <a href="#legal" className="text-muted-foreground hover:text-primary transition-colors font-medium block">Terms of Service</a>
                    <p className="text-xs text-muted-foreground">Fair usage and developer rights outlined</p>
                  </div>
                </li>
                <li>
                  <div className="space-y-1">
                    <a href="#legal" className="text-muted-foreground hover:text-primary transition-colors font-medium block">Security</a>
                    <p className="text-xs text-muted-foreground">ISO/GDPR-ready with 99.9% uptime guarantee</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} QoSCollab. All rights reserved.
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" /> GDPR Compliant
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> 99.9% Uptime SLA
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}                