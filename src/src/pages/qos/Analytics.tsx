import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Activity, Gauge, Timer, TrendingUp } from "lucide-react";
import { ChartContainer } from "@/components/ui/chart";
import { DashboardCard } from "@/components/DashboardCard";
import { AnalyticsWidget } from "@/components/AnalyticsWidget";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";

type PredictionRow = {
  id: string;
  latency: number;
  throughput: number;
  availability: number;
  reliability: number;
  response_time: number;
  predicted_efficiency: number;
  created_at: string;
};

type EfficiencyLogRow = {
  status: string | null;
  latency_ms: number | null;
  created_at: string;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function Analytics() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [logs, setLogs] = useState<EfficiencyLogRow[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setError("Authentication required.");
          return;
        }

        const { data: predictionRows, error: predictionError } = await supabase
          .from("qos_predictions")
          .select("id, latency, throughput, availability, reliability, response_time, predicted_efficiency, created_at")
          .order("created_at", { ascending: false })
          .limit(200);

        if (predictionError) throw predictionError;
        setPredictions((predictionRows || []) as PredictionRow[]);

        const { data: logRows, error: logError } = await supabase
          .from("efficiency_logs")
          .select("status, latency_ms, created_at")
          .order("created_at", { ascending: false })
          .limit(200);

        if (!logError) {
          setLogs((logRows || []) as EfficiencyLogRow[]);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load analytics data.");
        toast({
          title: "Analytics error",
          description: err.message || "Unable to fetch data from Supabase.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  const analytics = useMemo(() => {
    const total = predictions.length;
    const avgEfficiency = total > 0
      ? predictions.reduce((sum, p) => sum + Number(p.predicted_efficiency || 0), 0) / total
      : 0;
    const avgLatency = total > 0
      ? predictions.reduce((sum, p) => sum + Number(p.latency || 0), 0) / total
      : 0;
    const avgThroughput = total > 0
      ? predictions.reduce((sum, p) => sum + Number(p.throughput || 0), 0) / total
      : 0;

    const successCount = logs.filter((l) => l.status === "success").length;
    const successRate = logs.length > 0 ? (successCount / logs.length) * 100 : 100;

    return { total, avgEfficiency, avgLatency, avgThroughput, successRate };
  }, [predictions, logs]);

  const efficiencyTrendData = useMemo(
    () =>
      [...predictions]
        .reverse()
        .map((p) => ({
          time: format(new Date(p.created_at), "MM-dd HH:mm"),
          efficiency: Number(p.predicted_efficiency || 0),
        })),
    [predictions],
  );

  const latencyVsEfficiencyData = useMemo(
    () =>
      predictions.map((p) => ({
        latency: Number(p.latency || 0),
        efficiency: Number(p.predicted_efficiency || 0),
      })),
    [predictions],
  );

  const throughputComparisonData = useMemo(
    () =>
      [...predictions]
        .sort((a, b) => Number(b.throughput || 0) - Number(a.throughput || 0))
        .slice(0, 12)
        .map((p, idx) => ({
          name: `P${idx + 1}`,
          throughput: Number(p.throughput || 0),
          efficiency: Number(p.predicted_efficiency || 0),
        })),
    [predictions],
  );

  const userPerformanceData = useMemo(
    () => [
      { metric: "Efficiency", score: clamp(analytics.avgEfficiency, 0, 100) },
      { metric: "Success Rate", score: clamp(analytics.successRate, 0, 100) },
      { metric: "Latency Score", score: clamp(100 - analytics.avgLatency / 10, 0, 100) },
      { metric: "Throughput Score", score: clamp((analytics.avgThroughput / 250) * 100, 0, 100) },
    ],
    [analytics],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 relative">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute top-40 -left-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
          </div>
          <Card className="metric-card">
            <CardContent className="py-10 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 mr-2 animate-spin" />
              Loading analytics dashboard...
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 relative">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute top-40 -left-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
          </div>
          <Card className="border-destructive">
            <CardContent className="py-8 text-destructive">{error}</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-10 space-y-8 relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute top-40 -left-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        </div>
        <div>
          <h1 className="text-4xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time insights for QoS prediction performance from Supabase data.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <AnalyticsWidget label="Total Predictions" value={String(analytics.total)} icon={<Activity className="h-4 w-4" />} />
          <AnalyticsWidget label="Avg Efficiency" value={`${analytics.avgEfficiency.toFixed(2)}%`} icon={<Gauge className="h-4 w-4" />} />
          <AnalyticsWidget label="Avg Latency" value={`${analytics.avgLatency.toFixed(2)}ms`} icon={<Timer className="h-4 w-4" />} />
          <AnalyticsWidget label="Success Rate" value={`${analytics.successRate.toFixed(2)}%`} icon={<TrendingUp className="h-4 w-4" />} />
        </div>

        {predictions.length === 0 ? (
          <Card className="metric-card">
            <CardContent className="py-10 text-center text-muted-foreground">
              No predictions available yet. Generate a prediction to populate analytics.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
          <DashboardCard
            title="Efficiency Trend Over Time"
            description="Efficiency score progression from recent predictions."
          >
            <div className="h-[320px]">
              <ChartContainer
                config={{
                  efficiency: { label: "Efficiency (%)", color: "hsl(var(--primary))" },
                }}
                className="h-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={efficiencyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="efficiency" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </DashboardCard>

          <DashboardCard
            title="Latency vs Efficiency"
            description="Relationship between latency and predicted efficiency."
          >
            <div className="h-[320px]">
              <ChartContainer
                config={{
                  efficiency: { label: "Efficiency (%)", color: "hsl(var(--accent))" },
                }}
                className="h-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="latency" name="Latency" unit="ms" />
                    <YAxis type="number" dataKey="efficiency" name="Efficiency" unit="%" domain={[0, 100]} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                    <Scatter data={latencyVsEfficiencyData} fill="hsl(var(--accent))" />
                  </ScatterChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </DashboardCard>

          <DashboardCard
            title="Throughput Comparison"
            description="Top throughput predictions with efficiency overlay."
          >
            <div className="h-[320px]">
              <ChartContainer
                config={{
                  throughput: { label: "Throughput", color: "hsl(var(--secondary))" },
                  efficiency: { label: "Efficiency %", color: "hsl(var(--primary))" },
                }}
                className="h-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={throughputComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="throughput" fill="hsl(var(--secondary))" name="Throughput" />
                    <Bar dataKey="efficiency" fill="hsl(var(--primary))" name="Efficiency %" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </DashboardCard>

          <DashboardCard
            title="User Performance Metrics"
            description="Composite score view from prediction and log history."
          >
            <div className="h-[320px]">
              <ChartContainer
                config={{
                  score: { label: "Score", color: "hsl(var(--primary))" },
                }}
                className="h-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={userPerformanceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis type="category" dataKey="metric" width={110} />
                    <Tooltip />
                    <Bar dataKey="score" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </DashboardCard>
        </div>
        )}
      </div>
    </div>
  );
}
