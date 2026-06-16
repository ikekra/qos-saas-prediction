import type { ReliabilityStatus } from "./types";

export const latencyStatus = (latencyMs: number): ReliabilityStatus => {
  if (latencyMs > 1200) return "critical";
  if (latencyMs > 600) return "warning";
  return "healthy";
};
