import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PredictionForm, PredictionFormValues } from "@/components/PredictionForm";
import { DashboardCard } from "@/components/DashboardCard";
import { ServiceCard } from "@/components/recommendations/ServiceCard";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

type WebService = {
  id: string;
  service_name?: string | null;
  name?: string | null;
  provider: string;
  category: string;
  logo_url: string | null;
  availability_score: number | null;
  reliability_score: number | null;
  avg_latency: number | null;
};

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

const baseForm: PredictionFormValues = {
  service_id: null,
  latency: 120,
  throughput: 180,
  availability: 99.5,
  reliability: 98.5,
  response_time: 140,
};

export default function Recommendations() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState<WebService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<PredictionFormValues>(baseForm);
  const [submitting, setSubmitting] = useState(false);
  const [prediction, setPrediction] = useState<PredictionRow | null>(null);
  const [history, setHistory] = useState<PredictionRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data, error } = await supabase
          .from("web_services")
          .select(
            "id, service_name, name, provider, category, logo_url, availability_score, reliability_score, avg_latency",
          )
          .eq("is_active", true)
          .order("service_name");

        if (error) throw error;
        setServices((data || []) as WebService[]);
      } catch (error: any) {
        toast({
          title: "Failed to load services",
          description: error.message || "Unable to fetch services.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [toast]);

  useEffect(() => {
    const requestedId = searchParams.get("serviceId");
    if (!requestedId || services.length === 0) return;
    const service = services.find((item) => item.id === requestedId);
    if (!service) return;
    handleSelectService(service);
  }, [searchParams, services]);

  const fetchHistory = async () => {
    setHistoryError(null);
    try {
      const { data, error } = await supabase
        .from("qos_predictions")
        .select("id, service_id, latency, throughput, availability, reliability, response_time, predicted_efficiency, created_at")
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

  const categories = useMemo(
    () => Array.from(new Set(services.map((service) => service.category))).sort(),
    [services],
  );

  const filteredServices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return services.filter((service) => {
      const name = (service.service_name || service.name || "").toLowerCase();
      const matchesTerm =
        !term ||
        name.includes(term) ||
        service.provider.toLowerCase().includes(term);
      const matchesCategory = categoryFilter === "all" || service.category === categoryFilter;
      return matchesTerm && matchesCategory;
    });
  }, [services, searchTerm, categoryFilter]);

  const recommendations = useMemo(() => {
    const historyWithService = history.filter((row) => row.service_id);
    const latencyPreference =
      historyWithService.length > 0
        ? historyWithService.reduce((sum, row) => sum + Number(row.latency || 0), 0) / historyWithService.length
        : 150;

    const efficiencyByService = historyWithService.reduce<Record<string, { total: number; count: number }>>(
      (acc, row) => {
        const id = row.service_id as string;
        acc[id] = acc[id] || { total: 0, count: 0 };
        acc[id].total += Number(row.predicted_efficiency || 0);
        acc[id].count += 1;
        return acc;
      },
      {},
    );

    const scored = filteredServices.map((service) => {
      const serviceId = service.id;
      const efficiencyEntry = efficiencyByService[serviceId];
      const predictedEfficiency = efficiencyEntry ? efficiencyEntry.total / efficiencyEntry.count : null;

      const availabilityScore = Number(service.availability_score ?? 0);
      const latency = Number(service.avg_latency ?? latencyPreference);
      const latencyScore = Math.max(0, 200 - Math.abs(latency - latencyPreference)) / 2;

      const efficiencyScore = predictedEfficiency ?? availabilityScore;
      const usageBoost = efficiencyEntry ? Math.min(10, efficiencyEntry.count * 2) : 0;

      const recommendationScore =
        efficiencyScore * 0.45 + availabilityScore * 0.25 + latencyScore * 0.2 + usageBoost * 0.1;

      return {
        ...service,
        recommendationScore,
        predictedEfficiency,
      };
    });

    const ranked = [...scored].sort((a, b) => b.recommendationScore - a.recommendationScore);
    const recommendedIds = new Set(ranked.slice(0, 6).map((service) => service.id));

    return ranked.map((service) => ({
      ...service,
      recommended: recommendedIds.has(service.id),
    }));
  }, [filteredServices, history]);

  const handleSelectService = (service: WebService) => {
    setSelectedServiceId(service.id);
    setFormValues((prev) => ({
      ...prev,
      service_id: service.id,
      latency: service.avg_latency ?? prev.latency,
      response_time: service.avg_latency ?? prev.response_time,
      availability: service.availability_score ?? prev.availability,
      reliability: service.reliability_score ?? service.availability_score ?? prev.reliability,
    }));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
      if (!data?.prediction) throw new Error("Prediction response is missing.");

      setPrediction(data.prediction as PredictionRow);
      toast({
        title: "Prediction complete",
        description: `Predicted efficiency: ${Number(data.prediction.predicted_efficiency).toFixed(2)}%`,
      });
      await fetchHistory();
    } catch (error: any) {
      toast({
        title: "Prediction failed",
        description: error.message || "Unable to get prediction.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-10 space-y-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Service Recommendations</h1>
          </div>
          <p className="text-muted-foreground">
            Choose a service, auto-fill QoS defaults, and run an efficiency prediction.
          </p>
        </div>

        <Card className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by service or provider..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline">Total Services: {filteredServices.length}</Badge>
              {selectedServiceId && <Badge variant="secondary">Selected Service</Badge>}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading services...</div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No services found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {recommendations.map((service) => {
              const displayName = service.service_name || service.name || "Service";
              return (
                <ServiceCard
                  key={service.id}
                  name={displayName}
                  provider={service.provider}
                  category={service.category}
                  logoUrl={service.logo_url}
                  availabilityScore={service.availability_score}
                  recommendationScore={service.recommendationScore}
                  recommended={service.recommended}
                  selected={service.id === selectedServiceId}
                  onSelect={() => handleSelectService(service)}
                />
              );
            })}
          </div>
        )}

        <div ref={formRef} />
        {selectedServiceId && (
          <Card className="shadow-soft">
            <CardContent className="py-4 text-sm">
              Selected Service:{" "}
              <span className="font-semibold">
                {services.find((service) => service.id === selectedServiceId)?.service_name ||
                  services.find((service) => service.id === selectedServiceId)?.name ||
                  "Service"}
              </span>
            </CardContent>
          </Card>
        )}
        <DashboardCard
          title="QoS Prediction Form"
          description="Select a service above to auto-fill defaults, then adjust inputs and predict."
        >
          <PredictionForm
            services={services}
            loadingServices={loading}
            initialValues={formValues}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        </DashboardCard>

        {prediction && (
          <Card className="shadow-soft">
            <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Latest prediction at {format(new Date(prediction.created_at), "MMM dd, yyyy HH:mm:ss")}
              </div>
              <Badge variant="secondary" className="text-base px-4 py-2">
                Efficiency: {Number(prediction.predicted_efficiency).toFixed(2)}%
              </Badge>
            </CardContent>
          </Card>
        )}

        {historyError && (
          <Card className="border-destructive">
            <CardContent className="py-4 text-sm text-destructive">
              {historyError}
            </CardContent>
          </Card>
        )}

        <DashboardCard
          title="Prediction History"
          description="Recent predictions stored in Supabase."
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
                      <td className="p-3 text-sm">
                        {format(new Date(row.created_at), "yyyy-MM-dd HH:mm:ss")}
                      </td>
                      <td className="p-3 text-sm text-right">{Number(row.latency).toFixed(2)}</td>
                      <td className="p-3 text-sm text-right">{Number(row.throughput).toFixed(2)}</td>
                      <td className="p-3 text-sm text-right">{Number(row.availability).toFixed(2)}%</td>
                      <td className="p-3 text-sm text-right">{Number(row.reliability).toFixed(2)}%</td>
                      <td className="p-3 text-sm text-right">{Number(row.response_time).toFixed(2)}</td>
                      <td className="p-3 text-sm text-right font-semibold">
                        {Number(row.predicted_efficiency).toFixed(2)}%
                      </td>
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
