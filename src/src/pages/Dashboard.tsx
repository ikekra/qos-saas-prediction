import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plus, FolderKanban, TrendingUp, CheckCircle, Clock, Zap, Timer, AlertCircle, TrendingDown } from 'lucide-react';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { UserStatsCard } from '@/components/dashboard/UserStatsCard';
import { PerformanceMetricCard } from '@/components/dashboard/PerformanceMetricCard';
import { CategoryRow } from '@/components/dashboard/CategoryRow';
import { RecommendationCarousel } from '@/components/dashboard/RecommendationCarousel';
import { LiveChart } from '@/components/dashboard/LiveChart';
import { ComparisonQuickView } from '@/components/dashboard/ComparisonQuickView';
import { ScrollableRow } from '@/components/ScrollableRow';
import { motion } from 'framer-motion';

interface PerformanceMetrics {
  avgLatency: number;
  avgThroughput: number;
  errorRate: number;
  uptime: number;
}

interface ServicesByCategory {
  [key: string]: any[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    planning: 0,
    inProgress: 0,
    completed: 0,
  });
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    avgLatency: 0,
    avgThroughput: 0,
    errorRate: 0,
    uptime: 0,
  });
  const [servicesByCategory, setServicesByCategory] = useState<ServicesByCategory>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchPerformanceMetrics();
    fetchServicesByCategory();
  }, [user]);

  const fetchStats = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('projects')
      .select('status')
      .eq('owner', user.id);

    if (!error && data) {
      const statsData = {
        total: data.length,
        planning: data.filter(p => p.status === 'planning').length,
        inProgress: data.filter(p => p.status === 'in-progress').length,
        completed: data.filter(p => p.status === 'completed').length,
      };
      setStats(statsData);
    }

    setLoading(false);
  };

  const fetchPerformanceMetrics = async () => {
    if (!user) return;

    try {
      const { data: tests } = await supabase
        .from('test_results')
        .select('latency, throughput, error_rate')
        .eq('user_id', user.id);

      if (tests && tests.length > 0) {
        const avgLatency = tests.reduce((acc, t) => acc + Number(t.latency || 0), 0) / tests.length;
        const avgThroughput = tests.reduce((acc, t) => acc + Number(t.throughput || 0), 0) / tests.length;
        const avgErrorRate = tests.reduce((acc, t) => acc + Number(t.error_rate || 0), 0) / tests.length;
        const uptime = 100 - avgErrorRate;

        setPerformanceMetrics({
          avgLatency: Math.round(avgLatency),
          avgThroughput: Math.round(avgThroughput),
          errorRate: Math.round(avgErrorRate * 10) / 10,
          uptime: Math.round(uptime * 10) / 10,
        });
      }
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
    }
  };

  const fetchServicesByCategory = async () => {
    try {
      const { data: services } = await supabase
        .from('services')
        .select('*')
        .order('avg_rating', { ascending: false });

      if (services) {
        const grouped = services.reduce((acc, service) => {
          const category = service.category || 'Other';
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(service);
          return acc;
        }, {} as ServicesByCategory);

        setServicesByCategory(grouped);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8 space-y-8 relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-40 -left-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        </div>
        {/* Hero Section */}
        <DashboardHero />

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* User Stats & Performance Metrics */}
            <motion.div
              className="grid gap-6 lg:grid-cols-3"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <UserStatsCard />
              <LiveChart />
              <ComparisonQuickView />
            </motion.div>

            {/* Performance Overview - Horizontal Scroll */}
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.05 }}
            >
              <h2 className="text-2xl font-bold">Performance Overview</h2>
              <ScrollableRow title="">
                <PerformanceMetricCard
                  title="Average Latency"
                  value={performanceMetrics.avgLatency}
                  unit="ms"
                  icon={Timer}
                  change={-5}
                  index={0}
                />
                <PerformanceMetricCard
                  title="Average Throughput"
                  value={performanceMetrics.avgThroughput}
                  unit="req/s"
                  icon={Zap}
                  change={12}
                  index={1}
                />
                <PerformanceMetricCard
                  title="Error Rate"
                  value={performanceMetrics.errorRate}
                  unit="%"
                  icon={AlertCircle}
                  change={-2}
                  index={2}
                />
                <PerformanceMetricCard
                  title="Uptime"
                  value={performanceMetrics.uptime}
                  unit="%"
                  icon={TrendingUp}
                  change={0.5}
                  index={3}
                />
              </ScrollableRow>
            </motion.div>

            {/* Category-Based Service Rows */}
            <motion.div
              className="space-y-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {Object.entries(servicesByCategory).map(([category, services]) => (
                <CategoryRow key={category} category={category} services={services} />
              ))}
            </motion.div>

            {/* Recommendations Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <RecommendationCarousel />
            </motion.div>

            {/* Project Stats */}
            <motion.div
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card className="gradient-card shadow-soft hover:shadow-medium transition-all duration-300">
                <CardHeader className="pb-2">
                  <CardDescription>Total Projects</CardDescription>
                  <CardTitle className="text-3xl">{stats.total}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground">
                    <FolderKanban className="inline mr-2 h-4 w-4" />
                    All projects
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-card shadow-soft hover:shadow-medium transition-all duration-300">
                <CardHeader className="pb-2">
                  <CardDescription>Planning</CardDescription>
                  <CardTitle className="text-3xl">{stats.planning}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground">
                    <Clock className="inline mr-2 h-4 w-4" />
                    In planning phase
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-card shadow-soft hover:shadow-medium transition-all duration-300">
                <CardHeader className="pb-2">
                  <CardDescription>In Progress</CardDescription>
                  <CardTitle className="text-3xl">{stats.inProgress}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground">
                    <TrendingUp className="inline mr-2 h-4 w-4" />
                    Active projects
                  </div>
                </CardContent>
              </Card>

              <Card className="gradient-card shadow-soft hover:shadow-medium transition-all duration-300">
                <CardHeader className="pb-2">
                  <CardDescription>Completed</CardDescription>
                  <CardTitle className="text-3xl">{stats.completed}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-muted-foreground">
                    <CheckCircle className="inline mr-2 h-4 w-4" />
                    Finished projects
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card className="gradient-card shadow-medium">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Get started with these common tasks</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Link to="/projects/new">
                    <Button variant="outline" className="w-full justify-start" size="lg">
                      <Plus className="mr-2 h-5 w-5" />
                      Create New Project
                    </Button>
                  </Link>
                  <Link to="/projects">
                    <Button variant="outline" className="w-full justify-start" size="lg">
                      <FolderKanban className="mr-2 h-5 w-5" />
                      View All Projects
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </main>

      {/* Floating Action Button for Mobile */}
      <Link to="/projects/new" className="md:hidden fixed bottom-6 right-6 z-50">
        <Button size="lg" className="h-14 w-14 rounded-full shadow-large hover-scale">
          <Plus className="h-6 w-6" />
        </Button>
      </Link>
    </div>
  );
}
