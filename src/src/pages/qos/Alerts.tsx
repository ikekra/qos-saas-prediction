import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQosAlerts } from "@/hooks/useQosAlerts";

export default function QosAlerts() {
  const { alerts, loadingAlerts, unreadCount, markAsRead, markAllAsRead } = useQosAlerts();
  const [serviceFilter, setServiceFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const serviceOptions = useMemo(
    () => Array.from(new Set(alerts.map((a) => a.service))).sort(),
    [alerts],
  );

  const filtered = alerts.filter((a) => {
    const serviceOk = serviceFilter === "all" || a.service === serviceFilter;
    const severityOk = severityFilter === "all" || a.severity === severityFilter;
    return serviceOk && severityOk;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8 space-y-6">
        <Card className="brand-card">
          <CardHeader>
            <CardTitle>Alert History</CardTitle>
            <CardDescription>
              Filterable QoS event log for downtime, SLA breaches, token thresholds, and spikes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Service" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All services</SelectItem>
                  {serviceOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="secondary" onClick={markAllAsRead}>
                Mark all as read ({unreadCount})
              </Button>
            </div>

            {loadingAlerts ? (
              <p className="text-sm text-muted-foreground">Loading alerts...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No alerts for selected filters.</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((alert) => (
                  <div
                    key={alert.id}
                    className={`rounded-lg border p-3 ${alert.read ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{alert.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {alert.service} | {alert.metric} | {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs rounded-full px-2 py-1 ${
                            alert.severity === "critical"
                              ? "bg-rose-100 text-rose-700"
                              : alert.severity === "warning"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {alert.severity}
                        </span>
                        {!alert.read && (
                          <Button size="sm" variant="outline" onClick={() => markAsRead(alert.id)}>
                            Mark read
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
