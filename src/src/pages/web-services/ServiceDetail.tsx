import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type WebService = {
  id: string;
  name: string;
  category: string;
  logo_url: string | null;
  provider: string;
  description: string;
  base_url: string | null;
  docs_url: string | null;
  base_latency_estimate: number | null;
  availability_score: number | null;
  tags: string[] | null;
};

export default function WebServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<WebService | null>(null);

  useEffect(() => {
    const fetchService = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from("web_services")
          .select("id, name, category, logo_url, provider, description, base_url, docs_url, base_latency_estimate, availability_score, tags")
          .eq("id", id)
          .single();

        if (error) throw error;
        setService(data as WebService);
      } catch (error: any) {
        toast({
          title: "Failed to load service",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchService();
  }, [id, toast]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-10 space-y-6">
        <Button variant="ghost" onClick={() => navigate("/directory")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Directory
        </Button>

        {loading ? (
          <Card className="metric-card">
            <CardContent className="py-10 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Loading service...
            </CardContent>
          </Card>
        ) : !service ? (
          <Card className="metric-card">
            <CardContent className="py-10 text-center text-muted-foreground">
              Service not found.
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-medium">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl border bg-white p-3 shadow-sm">
                  {service.logo_url ? (
                    <img src={service.logo_url} alt={service.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      N/A
                    </div>
                  )}
                </div>
                <div>
                  <CardTitle className="text-2xl">{service.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{service.provider}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize">{service.category}</Badge>
                <Badge variant="secondary">
                  Reliability {service.availability_score ? `${service.availability_score.toFixed(2)}%` : "N/A"}
                </Badge>
                <Badge variant="secondary">
                  Latency {service.base_latency_estimate ? `${service.base_latency_estimate.toFixed(0)} ms` : "N/A"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{service.description}</p>
              {service.tags && service.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {service.tags.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              )}
              <Button variant="outline" className="gap-2">
                <Globe className="h-4 w-4" />
                Visit Provider
              </Button>
              <Button
                className="gap-2"
                onClick={() =>
                  navigate(`/qos/run-test?serviceUrl=${encodeURIComponent(service.base_url || service.docs_url || '')}`)
                }
                disabled={!service.base_url && !service.docs_url}
              >
                Run Test
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
