export type ReliabilityStatus = "healthy" | "warning" | "critical";

export interface QosSample {
  latencyMs: number;
  successfulRequests: number;
  totalRequests: number;
  observedAt: string;
}

export interface ReliabilitySummary {
  availability: number;
  errorRate: number;
  averageLatencyMs: number;
  status: ReliabilityStatus;
}
