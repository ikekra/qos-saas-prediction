import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { DashboardCard } from "@/components/DashboardCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

type PredictionRow = {
  id: string;
  predicted_efficiency: number;
  created_at: string;
};

export default function Feedback() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const { data, error } = await supabase
          .from("qos_predictions")
          .select("id, predicted_efficiency, created_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) throw error;
        setPredictions((data || []) as PredictionRow[]);
      } catch (error: any) {
        toast({
          title: "Failed to load predictions",
          description: error.message || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPredictions();
  }, [toast]);

  const submitFeedback = async () => {
    if (!selectedId) {
      toast({ title: "Select a prediction first", variant: "destructive" });
      return;
    }
    if (!user?.id) {
      toast({ title: "Please sign in to submit feedback", variant: "destructive" });
      return;
    }
    const parsedRating = Math.min(5, Math.max(1, Number(rating)));
    setSaving(true);
    try {
      const { error } = await supabase.from("model_feedback").insert({
        user_id: user.id,
        prediction_id: selectedId,
        rating: parsedRating,
        comment: comment.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Feedback submitted" });
      setSelectedId("");
      setRating("5");
      setComment("");
    } catch (error: any) {
      toast({
        title: "Failed to submit feedback",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

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
          <h1 className="text-4xl font-bold mb-2">Model Feedback</h1>
          <p className="text-muted-foreground">
            Rate prediction quality and provide feedback to improve the model.
          </p>
        </div>

        <DashboardCard title="Submit Feedback" description="Select a prediction and rate it.">
          {loading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Loading predictions...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Prediction</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  <option value="">Select a prediction</option>
                  {predictions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {format(new Date(p.created_at), "yyyy-MM-dd HH:mm")} · {p.predicted_efficiency.toFixed(2)}%
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Rating (1-5)</Label>
                <Input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Comment</Label>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={submitFeedback} disabled={saving}>
                  {saving ? "Submitting..." : "Submit Feedback"}
                </Button>
              </div>
            </div>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
