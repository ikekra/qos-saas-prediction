import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ServiceCardProps = {
  name: string;
  provider: string;
  category: string;
  logoUrl?: string | null;
  availabilityScore?: number | null;
  recommendationScore?: number | null;
  recommended?: boolean;
  selected?: boolean;
  onSelect?: () => void;
};

const availabilityTone = (score?: number | null) => {
  if (score === null || score === undefined) return "bg-muted text-muted-foreground";
  if (score >= 99.9) return "bg-emerald-100 text-emerald-700";
  if (score >= 99.5) return "bg-green-100 text-green-700";
  if (score >= 99.0) return "bg-amber-100 text-amber-700";
  return "bg-orange-100 text-orange-700";
};

export function ServiceCard({
  name,
  provider,
  category,
  logoUrl,
  availabilityScore,
  recommendationScore,
  recommended = false,
  selected = false,
  onSelect,
}: ServiceCardProps) {
  return (
    <Card
      className={cn(
        "group h-full border bg-card/90 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
        selected && "ring-2 ring-primary/70",
        recommended && "border-primary/60",
      )}
    >
      <CardHeader className="flex flex-row items-center gap-3">
        <div className="h-12 w-12 rounded-xl border bg-white p-2 shadow-sm">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={name}
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
        <div className="min-w-0">
          <CardTitle className="text-base font-semibold leading-tight line-clamp-1">{name}</CardTitle>
          <p className="text-xs text-muted-foreground">{provider}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs capitalize">
            {category}
          </Badge>
          {recommended && <Badge className="text-xs">Recommended</Badge>}
        </div>
        <div
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
            availabilityTone(availabilityScore),
          )}
        >
          Availability {availabilityScore ? `${availabilityScore.toFixed(2)}%` : "N/A"}
        </div>
        {recommendationScore !== null && recommendationScore !== undefined && (
          <div className="text-xs text-muted-foreground">
            Score {recommendationScore.toFixed(1)}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button className="w-full" type="button" onClick={onSelect}>
          Select Service
        </Button>
      </CardFooter>
    </Card>
  );
}
