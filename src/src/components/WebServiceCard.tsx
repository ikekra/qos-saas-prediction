import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type WebServiceCardProps = {
  name: string;
  provider: string;
  category: string;
  logoUrl?: string | null;
  availabilityScore?: number | null;
  onViewDetails?: () => void;
};

const getReliabilityTone = (score?: number | null) => {
  if (score === null || score === undefined) return "bg-muted text-muted-foreground";
  if (score >= 99.9) return "bg-emerald-100 text-emerald-700";
  if (score >= 99.5) return "bg-green-100 text-green-700";
  if (score >= 99.0) return "bg-amber-100 text-amber-700";
  return "bg-orange-100 text-orange-700";
};

export function WebServiceCard({
  name,
  provider,
  category,
  logoUrl,
  availabilityScore,
  onViewDetails,
}: WebServiceCardProps) {
  return (
    <Card className="group h-full border bg-card/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
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
        <Badge variant="outline" className="text-xs capitalize">
          {category}
        </Badge>
        <div
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
            getReliabilityTone(availabilityScore),
          )}
        >
          Reliability {availabilityScore ? `${availabilityScore.toFixed(2)}%` : "N/A"}
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={onViewDetails} type="button">
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}
