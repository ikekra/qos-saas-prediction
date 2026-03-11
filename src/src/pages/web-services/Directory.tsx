import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter, Globe } from "lucide-react";
import { Header } from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WebServiceCard } from "@/components/WebServiceCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type WebService = {
  id: string;
  name: string;
  category: string;
  logo_url: string | null;
  provider: string;
  description: string;
  availability_score: number | null;
};

export default function WebServicesDirectory() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [services, setServices] = useState<WebService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedService, setSelectedService] = useState<WebService | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data, error } = await supabase
          .from("web_services")
          .select("id, name, category, logo_url, provider, description, availability_score")
          .eq("is_active", true)
          .order("availability_score", { ascending: false });

        if (error) throw error;
        setServices((data || []) as WebService[]);
      } catch (error: any) {
        toast({
          title: "Error loading directory",
          description: error.message || "Unable to fetch web services.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [toast]);

  const categories = useMemo(
    () => Array.from(new Set(services.map((service) => service.category))).sort(),
    [services],
  );

  const filteredServices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return services.filter((service) => {
      const matchesTerm =
        !term ||
        service.name.toLowerCase().includes(term) ||
        service.provider.toLowerCase().includes(term) ||
        service.description.toLowerCase().includes(term);
      const matchesCategory = categoryFilter === "all" || service.category === categoryFilter;
      return matchesTerm && matchesCategory;
    });
  }, [services, searchTerm, categoryFilter]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-10 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">Web Services Directory</h1>
              <p className="text-muted-foreground">
                Explore trusted providers across cloud, payments, communications, AI, storage, and CDN.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by service, provider, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-[240px]">
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

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading directory...</div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No services found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredServices.map((service) => (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <WebServiceCard
                    name={service.name}
                    provider={service.provider}
                    category={service.category}
                    logoUrl={service.logo_url}
                    availabilityScore={service.availability_score}
                    onViewDetails={() => setSelectedService(service)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <Dialog open={!!selectedService} onOpenChange={(open) => !open && setSelectedService(null)}>
        <DialogContent className="max-w-2xl">
          {selectedService && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl border bg-white p-2 shadow-sm">
                    {selectedService.logo_url ? (
                      <img
                        src={selectedService.logo_url}
                        alt={selectedService.name}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        N/A
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{selectedService.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedService.provider}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="capitalize">
                    {selectedService.category}
                  </Badge>
                  <Badge variant="secondary">
                    Reliability{" "}
                    {selectedService.availability_score
                      ? `${selectedService.availability_score.toFixed(2)}%`
                      : "N/A"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{selectedService.description}</p>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => navigate(`/directory/${selectedService.id}`)}
                  >
                    View Full Page
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Globe className="h-4 w-4" />
                    Visit Provider
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
