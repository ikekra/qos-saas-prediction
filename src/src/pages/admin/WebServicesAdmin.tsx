import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type WebService = {
  id: string;
  name: string;
  category: string;
  logo_url: string | null;
  provider: string;
  description: string;
  base_latency_estimate: number | null;
  availability_score: number | null;
  is_active: boolean;
  tags: string[] | null;
  created_at: string;
};

type ServiceForm = Omit<
  WebService,
  "id" | "created_at"
> & { tags_text: string };

const categories = [
  "cloud services",
  "payment APIs",
  "communication APIs",
  "ai APIs",
  "storage services",
  "cdn services",
];

const emptyForm: ServiceForm = {
  name: "",
  category: "cloud services",
  logo_url: "",
  provider: "",
  description: "",
  base_latency_estimate: 0,
  availability_score: 99,
  is_active: true,
  tags: [],
  tags_text: "",
};

export default function WebServicesAdmin() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState<WebService[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(emptyForm);

  const canEdit = isAdmin;

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("web_services")
        .select("id, name, category, logo_url, provider, description, base_latency_estimate, availability_score, is_active, tags, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServices((data || []) as WebService[]);
    } catch (error: any) {
      toast({
        title: "Failed to load services",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const selectedService = useMemo(
    () => services.find((service) => service.id === editingId) || null,
    [services, editingId],
  );

  useEffect(() => {
    if (selectedService) {
      setForm({
        name: selectedService.name,
        category: selectedService.category,
        logo_url: selectedService.logo_url || "",
        provider: selectedService.provider,
        description: selectedService.description,
        base_latency_estimate: selectedService.base_latency_estimate ?? 0,
        availability_score: selectedService.availability_score ?? 99,
        is_active: selectedService.is_active,
        tags: selectedService.tags ?? [],
        tags_text: (selectedService.tags ?? []).join(", "),
      });
    } else {
      setForm(emptyForm);
    }
  }, [selectedService]);

  const handleSave = async () => {
    if (!canEdit) {
      toast({
        title: "Admin access required",
        description: "You do not have permission to modify the directory.",
        variant: "destructive",
      });
      return;
    }

    if (!form.name.trim() || !form.provider.trim() || !form.description.trim()) {
      toast({
        title: "Missing required fields",
        description: "Name, provider, and description are required.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        logo_url: form.logo_url?.trim() || null,
        provider: form.provider.trim(),
        description: form.description.trim(),
        base_latency_estimate: Number(form.base_latency_estimate) || 0,
        availability_score: Number(form.availability_score) || 0,
        is_active: form.is_active,
        tags: form.tags_text
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      if (editingId) {
        const { error } = await supabase
          .from("web_services")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Service updated" });
      } else {
        const { error } = await supabase
          .from("web_services")
          .insert(payload);
        if (error) throw error;
        toast({ title: "Service created" });
      }

      setEditingId(null);
      setForm(emptyForm);
      await fetchServices();
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error.message || "Unable to save changes.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-10">
          <Card className="metric-card">
            <CardContent className="py-10 text-center text-muted-foreground">
              Admin access required.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Web Services Directory</h1>
            <p className="text-muted-foreground">
              Manage the curated directory of popular internet services.
            </p>
          </div>
          <Button variant="outline" onClick={() => setEditingId(null)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Service
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle>{editingId ? "Edit Service" : "Create Service"}</CardTitle>
              <CardDescription>Fields marked * are required.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="service-name">Name *</Label>
                <Input
                  id="service-name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-provider">Provider *</Label>
                <Input
                  id="service-provider"
                  value={form.provider}
                  onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-logo">Logo URL</Label>
                <Input
                  id="service-logo"
                  value={form.logo_url || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, logo_url: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-description">Description *</Label>
                <Textarea
                  id="service-description"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="base-latency">Base Latency Estimate (ms)</Label>
                  <Input
                    id="base-latency"
                    type="number"
                    min={0}
                    value={form.base_latency_estimate ?? 0}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, base_latency_estimate: Number(e.target.value) }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="availability-score">Availability Score (%)</Label>
                  <Input
                    id="availability-score"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={form.availability_score ?? 0}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, availability_score: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="service-tags">Tags</Label>
                <Input
                  id="service-tags"
                  value={form.tags_text}
                  onChange={(e) => setForm((prev) => ({ ...prev, tags_text: e.target.value }))}
                  placeholder="api, payments, edge"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="service-active">Active</Label>
                <Switch
                  id="service-active"
                  checked={form.is_active}
                  onCheckedChange={(value) => setForm((prev) => ({ ...prev, is_active: value }))}
                />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Service
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle>Directory</CardTitle>
              <CardDescription>Click a service to edit.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading services...
                </div>
              ) : services.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No services found.</div>
              ) : (
                <div className="space-y-3 max-h-[720px] overflow-y-auto pr-2">
                  {services.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setEditingId(service.id)}
                      className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted/40 ${
                        editingId === service.id ? "border-primary/60 bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{service.name}</p>
                          <p className="text-xs text-muted-foreground">{service.provider} - {service.category}</p>
                        </div>
                        <span className={`text-xs ${service.is_active ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {service.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {service.description}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
