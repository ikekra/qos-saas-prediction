import { FormEvent, useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";

type WebService = {
  id: string;
  service_name?: string | null;
  name?: string | null;
  provider: string;
  avg_latency?: number | null;
  availability_score?: number | null;
  reliability_score?: number | null;
};

export type PredictionFormValues = {
  service_id?: string | null;
  latency: number;
  throughput: number;
  availability: number;
  reliability: number;
  response_time: number;
};

type PredictionFormProps = {
  services: WebService[];
  loadingServices: boolean;
  initialValues: PredictionFormValues;
  onSubmit: (values: PredictionFormValues) => Promise<void> | void;
  submitting?: boolean;
};

export function PredictionForm({
  services,
  loadingServices,
  initialValues,
  onSubmit,
  submitting = false,
}: PredictionFormProps) {
  const [values, setValues] = useState<PredictionFormValues>(initialValues);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const serviceOptions = useMemo(
    () =>
      services.map((service) => ({
        label: `${service.service_name || service.name || "Service"} - ${service.provider}`,
        value: service.id,
      })),
    [services],
  );

  const handleServiceSelect = (serviceId: string) => {
    const service = services.find((item) => item.id === serviceId);
    if (!service) return;
    setValues((prev) => ({
      ...prev,
      service_id: service.id,
      latency: service.avg_latency ?? prev.latency,
      response_time: service.avg_latency ?? prev.response_time,
      availability: service.availability_score ?? prev.availability,
      reliability: service.reliability_score ?? service.availability_score ?? prev.reliability,
    }));
  };

  const handleNumberChange = (key: keyof PredictionFormValues) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Number(event.target.value);
    const safeValue = Number.isFinite(raw) ? raw : 0;
    if (key === "availability" || key === "reliability") {
      const clamped = Math.min(100, Math.max(0, safeValue));
      setValues((prev) => ({ ...prev, [key]: clamped }));
      return;
    }
    const nonNegative = Math.max(0, safeValue);
    setValues((prev) => ({ ...prev, [key]: nonNegative }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label>Select Service</Label>
        <Select
          value={values.service_id ?? "none"}
          onValueChange={(value) => {
            if (value === "none") {
              setValues((prev) => ({ ...prev, service_id: null }));
              return;
            }
            handleServiceSelect(value);
          }}
          disabled={loadingServices}
        >
          <SelectTrigger>
            <SelectValue placeholder={loadingServices ? "Loading services..." : "Choose a service"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No service selected</SelectItem>
            {serviceOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Selecting a service auto-fills default QoS parameters. You can still edit them below.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="latency">Latency (ms)</Label>
        <Input id="latency" type="number" min={0} value={values.latency} onChange={handleNumberChange("latency")} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="throughput">Throughput</Label>
        <Input id="throughput" type="number" min={0} value={values.throughput} onChange={handleNumberChange("throughput")} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="availability">Availability (%)</Label>
        <Input id="availability" type="number" min={0} max={100} step="0.01" value={values.availability} onChange={handleNumberChange("availability")} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reliability">Reliability (%)</Label>
        <Input id="reliability" type="number" min={0} max={100} step="0.01" value={values.reliability} onChange={handleNumberChange("reliability")} required />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="response_time">Response Time (ms)</Label>
        <Input id="response_time" type="number" min={0} value={values.response_time} onChange={handleNumberChange("response_time")} required />
      </div>
      <div className="md:col-span-2">
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Predicting...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Predict Efficiency
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

