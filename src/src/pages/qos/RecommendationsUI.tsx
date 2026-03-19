import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { DashboardCard } from "@/components/DashboardCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Filter, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Recommendation = {
  id: string;
  score: number | null;
  reason: string | null;
  created_at: string;
  service_id: string;
  service: {
    id: string;
    service_name: string | null;
    name: string | null;
    provider: string;
    category: string;
    logo_url: string | null;
    description: string;
  };
};

export default function RecommendationsUI() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecs = async () => {
    try {
      const { data, error } = await supabase
        .from("service_recommendations")
        .select(
          "id, score, reason, created_at, service_id, service:web_services(id, service_name, name, provider, category, logo_url, description)",
        )
        .eq("service.is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const cleaned = (data || []).filter((rec) => rec.service) as Recommendation[];
      setRecs(cleaned);
    } catch (error: any) {
      toast({
        title: "Failed to load recommendations",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecs();
  }, [toast]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-recommendations", {
        body: { type: "user" },
      });
      if (error) throw error;
      toast({
        title: "Recommendations refreshed",
        description: `Found ${data?.recommendations?.length ?? 0} services`,
      });
      await fetchRecs();
    } catch (error: any) {
      toast({
        title: "Refresh failed",
        description: error.message || "Unable to refresh recommendations.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const categories = Array.from(
    new Set(recs.map((rec) => rec.service?.category).filter(Boolean)),
  ) as string[];
  const filteredRecs = categoryFilter === "all"
    ? recs
    : recs.filter((rec) => rec.service?.category === categoryFilter);

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
          <h1 className="text-4xl font-bold mb-2">Service Recommendations</h1>
          <p className="text-muted-foreground">Personalized suggestions based on your activity.</p>
        </div>

        <DashboardCard
          title="Recommended Services"
          description="Your latest recommended services."
          action={
            <div className="flex flex-wrap gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
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
              <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                Refresh
              </Button>
            </div>
          }
        >
          {loading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading recommendations...
            </div>
          ) : filteredRecs.length === 0 ? (
            <div className="text-muted-foreground">No recommendations yet.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredRecs.map((rec) => {
                if (!rec.service) return null;
                const displayName = rec.service.service_name || rec.service.name || "Service";
                return (
                  <div key={rec.id} className="rounded-lg border p-4 hover:bg-muted/40 transition">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-lg border bg-white p-2">
                        {rec.service.logo_url ? (
                          <img
                            src={rec.service.logo_url}
                            alt={displayName}
                            className="h-full w-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{displayName}</p>
                        <p className="text-xs text-muted-foreground">{rec.service.provider}</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {rec.service.description || "No description available."}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {rec.service.category && (
                        <Badge variant="outline" className="capitalize">
                          {rec.service.category}
                        </Badge>
                      )}
                      {rec.score !== null && (
                        <Badge variant="secondary">Score {rec.score.toFixed(2)}</Badge>
                      )}
                    </div>
                    {rec.reason && (
                      <p className="text-xs text-muted-foreground mt-2">{rec.reason}</p>
                    )}
                    <div className="mt-4">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          toast({
                            title: "Service selected",
                            description: `Opening ${displayName} in the prediction form.`,
                          });
                          navigate(`/recommendations?serviceId=${rec.service_id}`);
                        }}
                      >
                        Select Service
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
