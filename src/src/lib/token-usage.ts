export const TOKEN_POLL_INTERVAL_MS = Number(import.meta.env.VITE_TOKEN_POLL_INTERVAL_MS ?? 60000);
export const PAYMENT_ENABLED = String(import.meta.env.VITE_PAYMENT_ENABLED ?? "false").toLowerCase() === "true";

export const BILLING_CYCLE_TOKEN_LIMIT = 5000;

export const OPERATION_TOKEN_COST: Record<string, number> = {
  latency: 5,
  load: 15,
  uptime: 3,
  throughput: 10,
  prediction: 8,
  recommendation: 6,
};

export function getOperationCost(operationType: string) {
  return OPERATION_TOKEN_COST[operationType] ?? 5;
}

