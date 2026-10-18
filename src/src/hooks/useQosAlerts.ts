import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTokenUsage } from "@/hooks/useTokenUsage";

export type QosAlert = {
  id: string;
  severity: "info" | "warning" | "critical";
  service: string;
  metric: string;
  message: string;
  createdAt: string;
  read: boolean;
};

const STORAGE_KEY = "qos_alerts_read_map";
export const UNREAD_ALERT_COUNT_KEY = "qos_alert_unread_count";

function loadReadMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function saveReadMap(map: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore local storage failures
  }
}

export function useQosAlerts() {
  const { tokenUsage } = useTokenUsage();
  const [alerts, setAlerts] = useState<QosAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      const readMap = loadReadMap();
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setAlerts([]);
          setLoading(false);
          return;
        }

        const db = supabase as any;
        const { data: testsData } = await db
          .from("tests")
          .select("id, service_url, latency, success_rate, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30);

        const dynamicAlerts: QosAlert[] = [];
        const tests = testsData || [];

        tests.forEach((t: any) => {
          const latency = Number(t.latency ?? 0);
          const success = Number(t.success_rate ?? 100);
          if (latency > 500) {
            dynamicAlerts.push({
              id: `latency-${t.id}`,
              severity: latency > 1000 ? "critical" : "warning",
              service: t.service_url || "unknown-service",
              metric: "latency",
              message: `Response time spike detected (${latency.toFixed(0)}ms).`,
              createdAt: t.created_at,
              read: Boolean(readMap[`latency-${t.id}`]),
            });
          }
          if (success < 95) {
            dynamicAlerts.push({
              id: `success-${t.id}`,
              severity: success < 85 ? "critical" : "warning",
              service: t.service_url || "unknown-service",
              metric: "success_rate",
              message: `SLA breach detected (success ${success.toFixed(1)}%).`,
              createdAt: t.created_at,
              read: Boolean(readMap[`success-${t.id}`]),
            });
          }
        });

        const usagePct = tokenUsage.cycleLimit > 0 ? (tokenUsage.cycleUsed / tokenUsage.cycleLimit) * 100 : 0;
        if (usagePct >= 80) {
          dynamicAlerts.push({
            id: "token-80",
            severity: usagePct >= 95 ? "critical" : "warning",
            service: "account",
            metric: "token_balance",
            message: `Token usage reached ${usagePct.toFixed(0)}% of billing cycle limit.`,
            createdAt: new Date().toISOString(),
            read: Boolean(readMap["token-80"]),
          });
        }

        dynamicAlerts.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        setAlerts(dynamicAlerts);
        const unread = dynamicAlerts.filter((a) => !a.read).length;
        localStorage.setItem(UNREAD_ALERT_COUNT_KEY, String(unread));
      } finally {
        setLoading(false);
      }
    };

    void fetchAlerts();
  }, [tokenUsage.cycleLimit, tokenUsage.cycleUsed]);

  const unreadCount = useMemo(() => alerts.filter((a) => !a.read).length, [alerts]);

  const markAsRead = (id: string) => {
    setAlerts((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, read: true } : a));
      localStorage.setItem(UNREAD_ALERT_COUNT_KEY, String(next.filter((a) => !a.read).length));
      return next;
    });
    const readMap = loadReadMap();
    readMap[id] = true;
    saveReadMap(readMap);
  };

  const markAllAsRead = () => {
    const readMap = loadReadMap();
    alerts.forEach((a) => {
      readMap[a.id] = true;
    });
    saveReadMap(readMap);
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    localStorage.setItem(UNREAD_ALERT_COUNT_KEY, "0");
  };

  return {
    alerts,
    loadingAlerts: loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}
