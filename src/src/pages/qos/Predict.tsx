import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, TrendingUp, Gauge, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PredictionForm, PredictionFormValues } from "@/components/PredictionForm";
import { StatWidget } from "@/components/StatWidget";
import { DashboardCard } from "@/components/DashboardCard";

type PredictionRow = {
  id: string;
  service_id?: string | null;
  latency: number;
  throughput: number;
  availability: number;
  reliability: number;
  response_time: number;
  predicted_efficiency: number;
  created_at: string;
};

const initialForm: PredictionFormValues = {
  service_id: null,
  latency: 120,
  throughput: 180,
  availability: 99.5,
  reliability: 98.5,
  response_time: 140,
};

type WebService = {
  id: string;
  service_name?: string | null;
  name?: string | null;
  category: string;
  provider: string;
  avg_latency?: number | null;
  availability_score?: number | null;
  reliability_score?: number | null;
};

export default function Predict() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionRow | null>(null);
  const [history, setHistory] = useState<PredictionRow[]>([]);
  const [services, setServices] = useState<WebService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const trendData = [...history]
    .reverse()
    .map((row) => ({
      time: format(new Date(row.created_at), "MM-dd HH:mm"),
      efficiency: Number(row.predicted_efficiency),
    }));

  const fetchHistory = async () => {
    setHistoryError(null);
    try {
      const { data, error } = await supabase
        .from("qos_predictions")
        .select("id, latency, throughput, availability, reliability, response_time, predicted_efficiency, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory((data || []) as PredictionRow[]);
    } catch (error: any) {
      setHistoryError(error.message || "Failed to load prediction history.");
      toast({
        title: "Failed to load prediction history",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data, error } = await supabase
          .from("web_services")
          .select("id, service_name, name, category, provider, avg_latency, availability_score, reliability_score")
          .eq("is_active", true)
          .order("service_name");

        if (error) throw error;
        setServices((data || []) as WebService[]);
      } catch (error: any) {
        toast({
          title: "Failed to load services",
          description: error.message || "Unable to fetch directory.",
          variant: "destructive",
        });
      } finally {
        setLoadingServices(false);
      }
    };

    fetchServices();
  }, [toast]);


  const handleSubmit = async (values: PredictionFormValues) => {
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("predict-qos", {
        body: {
          service_id: values.service_id ?? null,
          latency: values.latency,
          throughput: values.throughput,
          availability: values.availability,
          reliability: values.reliability,
          response_time: values.response_time,
        },
      });

      if (error) throw error;

      if (!data?.prediction) {
        throw new Error("Prediction response is missing.");
      }

      setPrediction(data.prediction as PredictionRow);
      toast({
        title: "Prediction complete",
        description: `Predicted efficiency: ${Number(data.prediction.predicted_efficiency).toFixed(2)}%`,
      });
      await fetchHistory();
    } catch (error: any) {
      toast({
        title: "Prediction failed",
        description: error.message || "Unable to get prediction",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalPredictions = history.length;
  const avgEfficiency =
    totalPredictions > 0
      ? history.reduce((sum, row) => sum + Number(row.predicted_efficiency || 0), 0) / totalPredictions
      : 0;
  const bestEfficiency =
    totalPredictions > 0
      ? Math.max(...history.map((row) => Number(row.predicted_efficiency || 0)))
      : 0;
  const avgLatency =
    totalPredictions > 0
      ? history.reduce((sum, row) => sum + Number(row.latency || 0), 0) / totalPredictions
      : 0;
  const recentActivity = history.slice(0, 5).map((row) => ({
    id: row.id,
    time: format(new Date(row.created_at), "MMM dd, yyyy HH:mm"),
    message: `Predicted ${Number(row.predicted_efficiency).toFixed(2)}% efficiency`,
  }));

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
          <h1 className="text-4xl font-bold mb-2">QoS Efficiency Prediction</h1>
          <p className="text-muted-foreground">
            Send QoS metrics to the Supabase Edge Function and receive ML-based efficiency prediction.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatWidget
            label="Total Predictions"
            value={loadingHistory ? "-" : String(totalPredictions)}
            icon={<Activity className="h-4 w-4" />}
          />
          <StatWidget
            label="Avg Efficiency"
            value={loadingHistory ? "-" : `${avgEfficiency.toFixed(2)}%`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatWidget
            label="Best Efficiency"
            value={loadingHistory ? "-" : `${bestEfficiency.toFixed(2)}%`}
            icon={<Gauge className="h-4 w-4" />}
          />
          <StatWidget
            label="Avg Latency"
            value={loadingHistory ? "-" : `${avgLatency.toFixed(2)}ms`}
            icon={<History className="h-4 w-4" />}
          />
        </div>

        <DashboardCard
          title="QoS Input Form"
          description="Provide service performance metrics to predict efficiency score."
        >
          <PredictionForm
            services={services}
            loadingServices={loadingServices}
            initialValues={initialForm}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        </DashboardCard>

        {historyError && (
          <Card className="border-destructive">
            <CardContent className="py-4 text-sm text-destructive">
              {historyError}
            </CardContent>
          </Card>
        )}

        {prediction && (
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Latest Prediction</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-muted-foreground">
                Generated at {format(new Date(prediction.created_at), "MMM dd, yyyy HH:mm:ss")}
              </div>
              <Badge variant="secondary" className="text-base px-4 py-2">
                Efficiency: {Number(prediction.predicted_efficiency).toFixed(2)}%
              </Badge>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="shadow-medium lg:col-span-2">
          <CardHeader>
            <CardTitle>Efficiency Trend</CardTitle>
            <CardDescription>Recent prediction scores over time.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="py-8 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading trend...
              </div>
            ) : trendData.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No data available for trend chart.</div>
            ) : (
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="efficiency"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      name="Efficiency (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest prediction events.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="py-6 flex items-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading activity...
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="text-sm text-muted-foreground">No recent activity.</div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="rounded-md border p-3">
                      <p className="text-sm font-medium">{item.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.time}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DashboardCard
          title="Prediction History"
          description="Recent predictions stored in Supabase (`qos_predictions`)."
        >
            {loadingHistory ? (
              <div className="py-8 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading history...
              </div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No predictions found yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3">Date</th>
                      <th className="text-right p-3">Latency</th>
                      <th className="text-right p-3">Throughput</th>
                      <th className="text-right p-3">Availability</th>
                      <th className="text-right p-3">Reliability</th>
                      <th className="text-right p-3">Response Time</th>
                      <th className="text-right p-3">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-muted/40">
                        <td className="p-3 text-sm">{format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")}</td>
                        <td className="p-3 text-sm text-right">{Number(row.latency).toFixed(2)}</td>
                        <td className="p-3 text-sm text-right">{Number(row.throughput).toFixed(2)}</td>
                        <td className="p-3 text-sm text-right">{Number(row.availability).toFixed(2)}%</td>
                        <td className="p-3 text-sm text-right">{Number(row.reliability).toFixed(2)}%</td>
                        <td className="p-3 text-sm text-right">{Number(row.response_time).toFixed(2)}</td>
                        <td className="p-3 text-sm text-right font-semibold">{Number(row.predicted_efficiency).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </DashboardCard>
      </div>
    </div>
  );
}
