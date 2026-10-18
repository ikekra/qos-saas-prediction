import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Activity, Gauge, Timer, TrendingUp, Sparkles } from "lucide-react";
import { ChartContainer } from "@/components/ui/chart";
import { DashboardCard } from "@/components/DashboardCard";
import { AnalyticsWidget } from "@/components/AnalyticsWidget";
import { Badge } from "@/components/ui/badge";
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
const toNumber = (value: number | null | undefined) => (Number.isFinite(Number(value)) ? Number(value) : null);
const avg = (values: Array<number | null | undefined>) => {
  const valid = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
};

export default function Analytics() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [logs, setLogs] = useState<EfficiencyLogRow[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
  const retryRef = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notifiedRef = useRef(false);

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

  useEffect(() => {
    let active = true;

    const scheduleRetry = () => {
      const attempt = Math.min(retryRef.current + 1, 5);
      retryRef.current = attempt;
      const delay = Math.min(30000, 1000 * 2 ** attempt);
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      retryTimer.current = window.setTimeout(() => startSubscription(), delay);
    };

    const startSubscription = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || !active) return;

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel(`analytics-realtime-${data.user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'qos_predictions', filter: `user_id=eq.${data.user.id}` },
          () => {
            // refresh predictions
            supabase
              .from("qos_predictions")
              .select("id, latency, throughput, availability, reliability, response_time, predicted_efficiency, created_at")
              .order("created_at", { ascending: false })
              .limit(200)
              .then(({ data }) => {
                if (data && active) setPredictions(data as PredictionRow[]);
              });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setRealtimeStatus('connected');
            retryRef.current = 0;
            notifiedRef.current = false;
            return;
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setRealtimeStatus('reconnecting');
            if (!notifiedRef.current) {
              notifiedRef.current = true;
              toast({
                title: 'Realtime disconnected',
                description: 'Trying to reconnect to live updates.',
                variant: 'destructive',
              });
            }
            scheduleRetry();
          }
          if (status === 'CLOSED') {
            setRealtimeStatus('disconnected');
            scheduleRetry();
          }
        });

      channelRef.current = channel;
    };

    startSubscription();

    return () => {
      active = false;
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [toast]);

  const analytics = useMemo(() => {
    const total = predictions.length;
    const avgEfficiency = avg(predictions.map((p) => toNumber(p.predicted_efficiency)));
    const avgLatency = avg(predictions.map((p) => toNumber(p.latency)));
    const avgThroughput = avg(predictions.map((p) => toNumber(p.throughput)));

    const successCount = logs.filter((l) => l.status === "success").length;
    const successRate = logs.length > 0 ? (successCount / logs.length) * 100 : null;

    return { total, avgEfficiency, avgLatency, avgThroughput, successRate };
  }, [predictions, logs]);

  const efficiencyTrendData = useMemo(
    () =>
      [...predictions]
        .reverse()
        .map((p) => ({
          time: format(new Date(p.created_at), "MM-dd HH:mm"),
          efficiency: toNumber(p.predicted_efficiency) ?? 0,
        })),
    [predictions],
  );

  const latencyVsEfficiencyData = useMemo(
    () =>
      predictions.map((p) => ({
        latency: toNumber(p.latency) ?? 0,
        efficiency: toNumber(p.predicted_efficiency) ?? 0,
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
          throughput: toNumber(p.throughput) ?? 0,
          efficiency: toNumber(p.predicted_efficiency) ?? 0,
        })),
    [predictions],
  );

  const userPerformanceData = useMemo(
    () => [
      { metric: "Efficiency", score: clamp(analytics.avgEfficiency ?? 0, 0, 100) },
      { metric: "Success Rate", score: clamp(analytics.successRate ?? 0, 0, 100) },
      { metric: "Latency Score", score: clamp(100 - (analytics.avgLatency ?? 0) / 10, 0, 100) },
      { metric: "Throughput Score", score: clamp(((analytics.avgThroughput ?? 0) / 250) * 100, 0, 100) },
    ],
    [analytics],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
      <div className="container py-16 relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-40 -left-10 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <Card className="brand-card">
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
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-40 -left-10 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <Card className="brand-card border border-destructive/40">
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
          <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-40 -left-10 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="relative overflow-hidden rounded-3xl p-8 md:p-12 hero-surface text-white">
          <div className="absolute inset-0 hero-veil" />
          <div className="absolute inset-0 opacity-30 pattern-dots" />
          <div className="absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                <Sparkles className="h-3.5 w-3.5" />
                Analytics Studio
              </div>
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight">Analytics Dashboard</h1>
              <p className="text-white/80 text-base md:text-lg">
                Track QoS prediction performance with live insights from Supabase.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-white/80">
                <span className="rounded-full bg-white/15 px-3 py-1">Efficiency trend</span>
                <span className="rounded-full bg-white/15 px-3 py-1">Latency correlation</span>
                <span className="rounded-full bg-white/15 px-3 py-1">Throughput ranking</span>
              </div>
              <Badge variant="secondary" className="self-start">
                {realtimeStatus === 'connected'
                  ? 'Realtime: Connected'
                  : realtimeStatus === 'reconnecting'
                    ? 'Realtime: Reconnecting'
                    : 'Realtime: Disconnected'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <AnalyticsWidget label="Total Predictions" value={String(analytics.total)} icon={<Activity className="h-4 w-4" />} />
          <AnalyticsWidget label="Avg Efficiency" value={analytics.avgEfficiency === null ? "N/A" : `${analytics.avgEfficiency.toFixed(2)}%`} icon={<Gauge className="h-4 w-4" />} />
          <AnalyticsWidget label="Avg Latency" value={analytics.avgLatency === null ? "N/A" : `${analytics.avgLatency.toFixed(2)}ms`} icon={<Timer className="h-4 w-4" />} />
          <AnalyticsWidget label="Success Rate" value={analytics.successRate === null ? "N/A" : `${analytics.successRate.toFixed(2)}%`} icon={<TrendingUp className="h-4 w-4" />} />
        </div>

        {predictions.length === 0 ? (
          <Card className="brand-card">
            <CardContent className="py-10 text-center text-muted-foreground">
              No predictions available yet. Generate a prediction to populate analytics.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
          <DashboardCard
            title="Efficiency Trend Over Time"
            description="Efficiency score progression from recent predictions."
            className="brand-card"
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
            className="brand-card"
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
            className="brand-card"
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
            className="brand-card"
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
