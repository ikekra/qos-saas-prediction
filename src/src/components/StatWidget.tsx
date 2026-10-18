import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReactNode } from "react";

type StatWidgetProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  helper?: string;
};

export function StatWidget({ label, value, icon, helper }: StatWidgetProps) {
  return (
    <Card className="brand-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {icon ? <span className="brand-icon h-8 w-8">{icon}</span> : null}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {helper ? <p className="text-xs text-muted-foreground mt-1">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}
