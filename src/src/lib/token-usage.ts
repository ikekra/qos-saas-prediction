export const TOKEN_POLL_INTERVAL_MS = Number(import.meta.env.VITE_TOKEN_POLL_INTERVAL_MS ?? 60000);
export const PAYMENT_ENABLED = String(import.meta.env.VITE_PAYMENT_ENABLED ?? "false").toLowerCase() === "true";

export const BILLING_CYCLE_TOKEN_LIMIT = 5000;

const normalizeLegacyTokenCost = (value: number) => {
  switch (Math.round(value)) {
    case 5:
      return 50;
    case 8:
      return 60;
    case 10:
      return 70;
    case 15:
      return 100;
    case 20:
      return 120;
    case 25:
      return 150;
    default:
      return value;
  }
};

const envCost = (key: string, fallback: number) => {
  const raw = import.meta.env[key];
  const parsed = Number(raw);
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return normalizeLegacyTokenCost(value);
};

export const OPERATION_TOKEN_COST: Record<string, number> = {
  latency: envCost("VITE_TOKEN_COST_LATENCY", 5),
  load: envCost("VITE_TOKEN_COST_HISTORICAL_ANALYSIS", 25),
  uptime: envCost("VITE_TOKEN_COST_UPTIME", 8),
  throughput: envCost("VITE_TOKEN_COST_THROUGHPUT", 10),
  prediction: envCost("VITE_TOKEN_COST_FULL_REPORT", 20),
  recommendation: envCost("VITE_TOKEN_COST_ANOMALY_SCAN", 15),
  full_report: envCost("VITE_TOKEN_COST_FULL_REPORT", 20),
  historical_analysis: envCost("VITE_TOKEN_COST_HISTORICAL_ANALYSIS", 25),
  anomaly_scan: envCost("VITE_TOKEN_COST_ANOMALY_SCAN", 15),
};

export function getOperationCost(operationType: string) {
  return OPERATION_TOKEN_COST[operationType] ?? 50;
}
