import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { DashboardCard } from "@/components/DashboardCard";
import { StatWidget } from "@/components/StatWidget";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, AlertTriangle, Activity, Flame, Filter, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

type PredictionRow = {
  id: string;
  service_id: string | null;
  latency: number;
  throughput: number;
  availability: number;
  reliability: number;
  response_time: number;
  predicted_efficiency: number;
  created_at: string;
};

type WebService = {
  id: string;
  name: string;
  provider: string;
  category: string;
  base_latency_estimate: number | null;
  availability_score: number | null;
};

type ServiceScore = {
  id: string;
  name: string;
  provider: string;
  avg_efficiency: number;
  avg_latency: number;
  avg_throughput: number;
};

export default function AdvancedAnalytics() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [services, setServices] = useState<WebService[]>([]);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 14), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [categoryFilter, setCategoryFilter] = useState("all");
  const setRange = (days: number) => {
    const now = new Date();
    setDateTo(format(now, "yyyy-MM-dd"));
    setDateFrom(format(subDays(now, days), "yyyy-MM-dd"));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: predictionRows, error: predictionError } = await supabase
          .from("qos_predictions")
          .select("id, service_id, latency, throughput, availability, reliability, response_time, predicted_efficiency, created_at")
          .order("created_at", { ascending: false })
          .limit(300);

        if (predictionError) throw predictionError;

        const { data: serviceRows, error: serviceError } = await supabase
          .from("web_services")
          .select("id, name, provider, category, base_latency_estimate, availability_score")
          .eq("is_active", true);

        if (serviceError) throw serviceError;

        setPredictions((predictionRows || []) as PredictionRow[]);
        setServices((serviceRows || []) as WebService[]);
      } catch (error: any) {
        toast({
          title: "Failed to load analytics",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  const filteredPredictions = useMemo(() => {
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T23:59:59`);
    return predictions.filter((row) => {
      const created = new Date(row.created_at);
      return created >= start && created <= end;
    });
  }, [predictions, dateFrom, dateTo]);

  const filteredServices = useMemo(() => {
    if (categoryFilter === "all") return services;
    return services.filter((service) => service.category === categoryFilter);
  }, [services, categoryFilter]);

  const serviceScores = useMemo(() => {
    const byService: Record<string, PredictionRow[]> = {};
    filteredPredictions.forEach((row) => {
      if (!row.service_id) return;
      byService[row.service_id] = byService[row.service_id] || [];
      byService[row.service_id].push(row);
    });

    const scores: ServiceScore[] = filteredServices.map((service) => {
      const rows = byService[service.id] || [];
      const avgEfficiency =
        rows.length > 0
          ? rows.reduce((sum, r) => sum + r.predicted_efficiency, 0) / rows.length
          : service.availability_score ?? 0;
      const avgLatency =
        rows.length > 0
          ? rows.reduce((sum, r) => sum + r.latency, 0) / rows.length
          : service.base_latency_estimate ?? 0;
      const avgThroughput =
        rows.length > 0
          ? rows.reduce((sum, r) => sum + r.throughput, 0) / rows.length
          : 0;

      return {
        id: service.id,
        name: service.name,
        provider: service.provider,
        avg_efficiency: avgEfficiency,
        avg_latency: avgLatency,
        avg_throughput: avgThroughput,
      };
    });

    return scores;
  }, [filteredPredictions, filteredServices]);

  const topServices = useMemo(
    () => [...serviceScores].sort((a, b) => b.avg_efficiency - a.avg_efficiency).slice(0, 8),
    [serviceScores],
  );

  const worstLatency = useMemo(
    () => [...serviceScores].sort((a, b) => b.avg_latency - a.avg_latency).slice(0, 8),
    [serviceScores],
  );

  const predictionTrend = useMemo(
    () =>
      [...filteredPredictions]
        .reverse()
        .map((p) => ({
          time: format(new Date(p.created_at), "MM-dd HH:mm"),
          efficiency: p.predicted_efficiency,
        })),
    [filteredPredictions],
  );

  const heatmapData = useMemo(() => {
    if (filteredPredictions.length === 0) return [];
    const latencyBins = [0, 100, 200, 400, 800, 1200];
    const efficiencyBins = [0, 60, 75, 85, 92, 100];
    const buckets: Record<string, number> = {};

    filteredPredictions.forEach((p) => {
      const latIdx = Math.min(
        latencyBins.length - 2,
        latencyBins.findIndex((b, i) => p.latency >= b && p.latency < latencyBins[i + 1]),
      );
      const effIdx = Math.min(
        efficiencyBins.length - 2,
        efficiencyBins.findIndex((b, i) => p.predicted_efficiency >= b && p.predicted_efficiency < efficiencyBins[i + 1]),
      );
      const key = `${latIdx}-${effIdx}`;
      buckets[key] = (buckets[key] || 0) + 1;
    });

    return Object.entries(buckets).map(([key, count]) => {
      const [latIdx, effIdx] = key.split("-").map(Number);
      return {
        latency: (latencyBins[latIdx] + latencyBins[latIdx + 1]) / 2,
        efficiency: (efficiencyBins[effIdx] + efficiencyBins[effIdx + 1]) / 2,
        count,
      };
    });
  }, [filteredPredictions]);

  const totalPredictions = filteredPredictions.length;
  const avgEfficiency =
    totalPredictions > 0
      ? filteredPredictions.reduce((sum, p) => sum + p.predicted_efficiency, 0) / totalPredictions
      : 0;

  const exportTableToCsv = () => {
    if (serviceScores.length === 0) return;
    const headers = ["Service", "Provider", "Avg Efficiency", "Avg Latency", "Avg Throughput"];
    const rows = serviceScores.map((service) => [
      service.name,
      service.provider,
      service.avg_efficiency.toFixed(2),
      service.avg_latency.toFixed(2),
      service.avg_throughput.toFixed(2),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `advanced-analytics-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportRawPredictionsCsv = () => {
    if (filteredPredictions.length === 0) return;
    const headers = [
      "Date",
      "Service ID",
      "Latency",
      "Throughput",
      "Efficiency",
      "Availability",
      "Reliability",
      "Response Time",
    ];
    const rows = filteredPredictions.map((p) => [
      format(new Date(p.created_at), "yyyy-MM-dd HH:mm:ss"),
      p.service_id ?? "",
      p.latency.toFixed(2),
      p.throughput.toFixed(2),
      p.predicted_efficiency.toFixed(2),
      p.availability.toFixed(2),
      p.reliability.toFixed(2),
      p.response_time.toFixed(2),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raw-predictions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-16 flex items-center justify-center text-muted-foreground relative">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute top-40 -left-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
            <div className="absolute bottom-10 right-10 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
          </div>
          <Loader2 className="h-6 w-6 mr-2 animate-spin" />
          Loading advanced analytics...
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
          <h1 className="text-4xl font-bold mb-2">Advanced Analytics</h1>
          <p className="text-muted-foreground">
            Deep insights into service performance and user prediction trends.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatWidget label="Predictions" value={String(totalPredictions)} icon={<Activity className="h-4 w-4" />} />
          <StatWidget label="Avg Efficiency" value={`${avgEfficiency.toFixed(2)}%`} icon={<TrendingUp className="h-4 w-4" />} />
          <StatWidget label="Top Services" value={String(topServices.length)} icon={<Flame className="h-4 w-4" />} />
          <StatWidget label="Latency Alerts" value={String(worstLatency.length)} icon={<AlertTriangle className="h-4 w-4" />} />
        </div>

        <DashboardCard title="Filters" description="Refine analytics by date range and category.">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">From</Label>
              <Input id="dateFrom" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">To</Label>
              <Input id="dateTo" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Array.from(new Set(services.map((s) => s.category))).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-3">
              <Label>Quick Ranges</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setRange(7)}>
                  Last 7 days
                </Button>
                <Button type="button" variant="outline" onClick={() => setRange(14)}>
                  Last 14 days
                </Button>
                <Button type="button" variant="outline" onClick={() => setRange(30)}>
                  Last 30 days
                </Button>
                <Button type="button" variant="outline" onClick={() => setRange(90)}>
                  Last 90 days
                </Button>
              </div>
            </div>
          </div>
        </DashboardCard>

        <div className="grid gap-6 lg:grid-cols-2">
          <DashboardCard title="Top Performing Services" description="Highest efficiency across services.">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topServices}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg_efficiency" fill="hsl(var(--primary))" name="Efficiency" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>

          <DashboardCard title="Worst Latency Services" description="Highest average latency services.">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={worstLatency}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg_latency" fill="hsl(var(--destructive))" name="Latency (ms)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>

          <DashboardCard title="User Prediction Trends" description="Efficiency predictions over time.">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={predictionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="efficiency" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>

          <DashboardCard title="Efficiency Heatmap" description="Latency vs efficiency density.">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="latency" name="Latency" unit="ms" />
                  <YAxis type="number" dataKey="efficiency" name="Efficiency" unit="%" domain={[0, 100]} />
                  <ZAxis type="number" dataKey="count" range={[40, 200]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={heatmapData} fill="hsl(var(--secondary))" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </DashboardCard>
        </div>

        <DashboardCard
          title="Service Summary Table"
          description="Filtered services with QoS aggregates."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={exportRawPredictionsCsv} disabled={filteredPredictions.length === 0}>
                <Download className="h-4 w-4" />
                Export Raw
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportTableToCsv} disabled={serviceScores.length === 0}>
                <Download className="h-4 w-4" />
                Export Summary
              </Button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">Service</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3 text-right">Avg Efficiency</th>
                  <th className="p-3 text-right">Avg Latency</th>
                  <th className="p-3 text-right">Avg Throughput</th>
                </tr>
              </thead>
              <tbody>
                {serviceScores.length === 0 ? (
                  <tr>
                    <td className="p-4 text-muted-foreground" colSpan={5}>
                      No data for the selected filters.
                    </td>
                  </tr>
                ) : (
                  serviceScores.map((service) => (
                    <tr key={service.id} className="border-b">
                      <td className="p-3">{service.name}</td>
                      <td className="p-3">{service.provider}</td>
                      <td className="p-3 text-right">{service.avg_efficiency.toFixed(2)}%</td>
                      <td className="p-3 text-right">{service.avg_latency.toFixed(2)} ms</td>
                      <td className="p-3 text-right">{service.avg_throughput.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}
