import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AnalyticsWidgetProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  hint?: string;
  className?: string;
};

export function AnalyticsWidget({ label, value, icon, hint, className }: AnalyticsWidgetProps) {
  return (
    <Card className={cn("brand-card", className)}>
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? (
          <div className="brand-icon h-10 w-10">{icon}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
