import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Clock, TrendingUp, Activity, Play, AlertTriangle, Download, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface Stats {
  totalTests: number;
  avgLatency: number;
  avgUptime: number;
  successRate: number;
}

interface Test {
  id: string;
  service_url: string;
  test_type: string;
  latency: number;
  uptime: number;
  throughput: number;
  success_rate: number;
  created_at: string;
}

interface Prediction {
  id: string;
  service_id?: string | null;
  latency: number;
  throughput: number;
  availability: number;
  reliability: number;
  response_time: number;
  predicted_efficiency: number;
  created_at: string;
}

export default function QosDashboard() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({
    totalTests: 0,
    avgLatency: 0,
    avgUptime: 0,
    successRate: 0,
  });
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [predictionLoading, setPredictionLoading] = useState(true);

  // Alert thresholds
  const LATENCY_THRESHOLD = 500; // ms
  const UPTIME_THRESHOLD = 95; // %
  const SUCCESS_THRESHOLD = 90; // %

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data: testsData, error } = await supabase
        .from('tests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      if (testsData && testsData.length > 0) {
        setTests(testsData);
        
        const avgLatency = testsData.reduce((sum, t) => sum + (t.latency || 0), 0) / testsData.length;
        const avgUptime = testsData.reduce((sum, t) => sum + (t.uptime || 0), 0) / testsData.length;
        const successRate = testsData.reduce((sum, t) => sum + (t.success_rate || 0), 0) / testsData.length;

        setStats({
          totalTests: testsData.length,
          avgLatency,
          avgUptime,
          successRate,
        });

        // Check for alerts
        const newAlerts: string[] = [];
        if (avgLatency > LATENCY_THRESHOLD) {
          newAlerts.push(`High average latency detected: ${avgLatency.toFixed(2)}ms`);
        }
        if (avgUptime < UPTIME_THRESHOLD) {
          newAlerts.push(`Low uptime detected: ${avgUptime.toFixed(2)}%`);
        }
        if (successRate < SUCCESS_THRESHOLD) {
          newAlerts.push(`Low success rate: ${successRate.toFixed(2)}%`);
        }
        
        if (newAlerts.length > 0) {
          setAlerts(newAlerts);
        }
      }

      const { data: predictionData, error: predictionError } = await supabase
        .from('qos_predictions')
        .select('id, service_id, latency, throughput, availability, reliability, response_time, predicted_efficiency, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (predictionError) throw predictionError;
      setPredictions((predictionData || []) as Prediction[]);
    } catch (error: any) {
      toast({
        title: "Error Loading Stats",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setPredictionLoading(false);
    }
  };

  const exportToCSV = () => {
    if (tests.length === 0) {
      toast({
        title: "No Data",
        description: "No test results to export",
        variant: "destructive",
      });
      return;
    }

    const headers = ['Date', 'Service URL', 'Test Type', 'Latency (ms)', 'Uptime (%)', 'Throughput', 'Success Rate (%)'];
    const csvData = tests.map(test => [
      format(new Date(test.created_at), 'yyyy-MM-dd HH:mm:ss'),
      test.service_url,
      test.test_type,
      test.latency?.toFixed(2) || 'N/A',
      test.uptime?.toFixed(2) || 'N/A',
      test.throughput?.toFixed(2) || 'N/A',
      test.success_rate?.toFixed(2) || 'N/A',
    ]);

    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qos-tests-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Test results exported to CSV",
    });
  };

  const chartData = tests.slice(0, 10).reverse().map(test => ({
    name: format(new Date(test.created_at), 'MMM dd HH:mm'),
    latency: test.latency || 0,
    uptime: test.uptime || 0,
    success: test.success_rate || 0,
  }));

  const predictionChartData = predictions.slice(0, 8).reverse().map((row) => ({
    name: format(new Date(row.created_at), 'MMM dd HH:mm'),
    efficiency: row.predicted_efficiency || 0,
  }));

  const avgPrediction =
    predictions.length > 0
      ? predictions.reduce((sum, row) => sum + (row.predicted_efficiency || 0), 0) / predictions.length
      : 0;

  return (
    <div className="min-h-screen bg-background post-login-theme">
      <Header />
      
      <div className="container py-12 relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-48 -left-10 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute bottom-8 right-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <motion.div
          className="relative overflow-hidden rounded-3xl p-8 md:p-12 hero-surface text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="absolute inset-0 hero-veil" />
          <div className="absolute inset-0 opacity-30 pattern-grid" />
          <div className="absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                <Sparkles className="h-3.5 w-3.5" />
                Live QoS Intelligence
              </div>
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
                Unified QoS Command Center
              </h1>
              <p className="text-white/80 text-base md:text-lg">
                Monitor latency and uptime, track ML predictions, and export verified history — all in one place.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-white/80">
                <span className="rounded-full bg-white/15 px-3 py-1">Latency monitoring</span>
                <span className="rounded-full bg-white/15 px-3 py-1">Prediction tracking</span>
                <span className="rounded-full bg-white/15 px-3 py-1">CSV exports</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button onClick={exportToCSV} variant="secondary" size="lg" className="gap-2 shadow-soft">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Link to="/qos/run-test">
                <Button size="lg" className="gap-2 bg-white text-foreground hover:bg-white/90">
                  <Play className="h-4 w-4" />
                  Run New Test
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            {alerts.map((alert, index) => (
              <Card key={index} className="mb-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
                <CardContent className="py-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-200">{alert}</p>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}

        {/* Stats Grid */}
        <motion.div 
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-10 mt-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="brand-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
              <div className="brand-icon">
                <BarChart3 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalTests}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Performance tests run
              </p>
            </CardContent>
          </Card>

          <Card className="brand-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
              <div className="brand-icon">
                <Clock className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.avgLatency.toFixed(2)}ms</div>
              <p className="text-xs text-muted-foreground mt-1">
                Average response time
              </p>
            </CardContent>
          </Card>

          <Card className="brand-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Uptime</CardTitle>
              <div className="brand-icon">
                <TrendingUp className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.avgUptime.toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Service availability
              </p>
            </CardContent>
          </Card>

          <Card className="brand-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <div className="brand-icon">
                <Activity className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.successRate.toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Test completion rate
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          className="grid gap-6 lg:grid-cols-3 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Card className="shadow-medium lg:col-span-2 border border-border/70">
            <CardHeader>
              <CardTitle>Live Prediction Trend</CardTitle>
              <CardDescription>Latest ML efficiency scores</CardDescription>
            </CardHeader>
            <CardContent>
              {predictionLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading predictions...</div>
              ) : predictionChartData.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No predictions yet.</div>
              ) : (
                <ChartContainer
                  config={{
                    efficiency: { label: "Efficiency (%)", color: "hsl(var(--primary))" },
                  }}
                  className="h-[260px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={predictionChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} domain={[0, 100]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="efficiency" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-medium border border-border/70">
            <CardHeader>
              <CardTitle>Prediction Snapshot</CardTitle>
              <CardDescription>Recent activity & average</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Avg Efficiency</p>
                <p className="text-3xl font-bold">{avgPrediction.toFixed(2)}%</p>
              </div>
              <div className="space-y-2">
                {predictionLoading ? (
                  <p className="text-sm text-muted-foreground">Loading history...</p>
                ) : predictions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No predictions yet.</p>
                ) : (
                  predictions.slice(0, 5).map((row) => (
                    <div key={row.id} className="rounded-md border p-3">
                      <p className="text-sm font-medium">
                        {Number(row.predicted_efficiency).toFixed(2)}% efficiency
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(row.created_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <Link to="/qos/predict">
                <Button variant="secondary" className="w-full">View Prediction Page</Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {/* Real-Time Charts */}
        {tests.length > 0 && (
          <motion.div 
            className="grid gap-6 lg:grid-cols-2 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Latency Trend</CardTitle>
                <CardDescription>Real-time response time monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    latency: {
                      label: "Latency (ms)",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="latency" 
                        stroke="hsl(var(--primary))" 
                        fillOpacity={1} 
                        fill="url(#colorLatency)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Uptime and success rate over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    uptime: {
                      label: "Uptime (%)",
                      color: "hsl(var(--accent))",
                    },
                    success: {
                      label: "Success Rate (%)",
                      color: "hsl(var(--secondary))",
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="uptime" 
                        stroke="hsl(var(--accent))" 
                        strokeWidth={2}
                        name="Uptime (%)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="success" 
                        stroke="hsl(var(--secondary))" 
                        strokeWidth={2}
                        name="Success Rate (%)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div 
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <Card className="gradient-card shadow-soft hover:shadow-medium transition-all duration-300 hover-scale">
            <CardHeader>
              <CardTitle>Run Performance Test</CardTitle>
              <CardDescription>
                Test your web service for latency, load, uptime, or throughput
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/qos/run-test">
                <Button className="w-full">
                  <Play className="mr-2 h-4 w-4" />
                  Start Test
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="gradient-card shadow-soft hover:shadow-medium transition-all duration-300 hover-scale">
            <CardHeader>
              <CardTitle>View Reports</CardTitle>
              <CardDescription>
                Analyze historical data and performance trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/qos/reports">
                <Button variant="secondary" className="w-full">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Reports
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="brand-card">
            <CardHeader>
              <CardTitle>Analytics Dashboard</CardTitle>
              <CardDescription>
                Explore efficiency trends and performance correlations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/qos/analytics">
                <Button variant="secondary" className="w-full">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Analytics
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="gradient-card shadow-soft hover:shadow-medium transition-all duration-300 hover-scale">
            <CardHeader>
              <CardTitle>AI-Driven Insights</CardTitle>
              <CardDescription>
                Get intelligent recommendations to optimize performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/qos/predict">
                <Button variant="outline" className="w-full">
                  View Insights
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        {loading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading statistics...</p>
          </div>
        )}
      </div>
    </div>
  );
}
