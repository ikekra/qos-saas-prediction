export type ConfidenceScore = "low" | "medium" | "high";

type ReportMetrics = {
  predictedLatencyMs: number;
  predictedThroughputRps: number;
  predictedUptimePercent: number;
  baselineThroughputRps?: number;
};

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toInt = (value: string | undefined, fallback: number): number => Math.round(toNumber(value, fallback));

export const TOKEN_COSTS = {
  latency: toInt(Deno.env.get("TOKEN_COST_LATENCY"), 5),
  throughput: toInt(Deno.env.get("TOKEN_COST_THROUGHPUT"), 10),
  uptime: toInt(Deno.env.get("TOKEN_COST_UPTIME"), 8),
  fullReport: toInt(Deno.env.get("TOKEN_COST_FULL_REPORT"), 20),
  historicalAnalysis: toInt(Deno.env.get("TOKEN_COST_HISTORICAL_ANALYSIS"), 25),
  anomalyScan: toInt(Deno.env.get("TOKEN_COST_ANOMALY_SCAN"), 15),
} as const;

export const ALERT_THRESHOLDS = {
  latencyMs: toNumber(Deno.env.get("LATENCY_ALERT_MS"), 2000),
  uptimePercent: toNumber(Deno.env.get("UPTIME_ALERT_PERCENT"), 99.5),
  throughputDropRatio: toNumber(Deno.env.get("THROUGHPUT_DROP_ALERT"), 0.3),
} as const;

export const TOPUP_PACKAGES = [
  {
    amount: toNumber(Deno.env.get("TOKEN_PRICE_SMALL"), 5),
    tokens: toInt(Deno.env.get("TOKEN_PRICE_SMALL_TOKENS"), 5000),
  },
  {
    amount: toNumber(Deno.env.get("TOKEN_PRICE_MEDIUM"), 20),
    tokens: toInt(Deno.env.get("TOKEN_PRICE_MEDIUM_TOKENS"), 25000),
  },
  {
    amount: toNumber(Deno.env.get("TOKEN_PRICE_LARGE"), 50),
    tokens: toInt(Deno.env.get("TOKEN_PRICE_LARGE_TOKENS"), 100000),
  },
] as const;

const normalizePaymentMode = (raw: string) => {
  const mode = raw.toLowerCase();
  if (mode === "sandbox" || mode === "test") return "sandbox";
  if (mode === "mock") return "sandbox";
  return mode;
};

export const PAYMENT_MODE = normalizePaymentMode(
  Deno.env.get("PAYMENT_MODE") ?? Deno.env.get("BILLING_MODE") ?? "sandbox",
);

export function getTokenCost(operation: "latency" | "throughput" | "uptime" | "fullReport" | "historicalAnalysis" | "anomalyScan") {
  return TOKEN_COSTS[operation];
}

export function computeConfidenceScore(reliabilityPercent: number, availabilityPercent: number): ConfidenceScore {
  if (reliabilityPercent >= 99 && availabilityPercent >= 99.9) return "high";
  if (reliabilityPercent >= 97 && availabilityPercent >= 99.5) return "medium";
  return "low";
}

export function buildPerformanceAlerts(metrics: ReportMetrics): string[] {
  const alerts: string[] = [];

  if (metrics.predictedLatencyMs > ALERT_THRESHOLDS.latencyMs) {
    alerts.push(
      `Predicted latency ${metrics.predictedLatencyMs.toFixed(2)}ms exceeds ${ALERT_THRESHOLDS.latencyMs.toFixed(0)}ms threshold.`,
    );
  }

  if (metrics.predictedUptimePercent < ALERT_THRESHOLDS.uptimePercent) {
    alerts.push(
      `Predicted uptime ${metrics.predictedUptimePercent.toFixed(3)}% is below ${ALERT_THRESHOLDS.uptimePercent.toFixed(3)}%.`,
    );
  }

  if (typeof metrics.baselineThroughputRps === "number" && metrics.baselineThroughputRps > 0) {
    const dropRatio = (metrics.baselineThroughputRps - metrics.predictedThroughputRps) / metrics.baselineThroughputRps;
    if (dropRatio > ALERT_THRESHOLDS.throughputDropRatio) {
      alerts.push(
        `Predicted throughput drop ${(dropRatio * 100).toFixed(1)}% exceeds ${(ALERT_THRESHOLDS.throughputDropRatio * 100).toFixed(0)}% threshold.`,
      );
    }
  }

  return alerts;
}
