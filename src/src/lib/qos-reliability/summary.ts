import { availability } from "./availability";
import { errorRate } from "./error-rate";
import { latencyStatus } from "./latency";
import type { QosSample, ReliabilitySummary } from "./types";

export const summarizeReliability = (samples: QosSample[]): ReliabilitySummary => {
  if (samples.length === 0) return { availability: 0, errorRate: 0, averageLatencyMs: 0, status: "critical" };
  const totals = samples.reduce((value, sample) => ({
    successful: value.successful + sample.successfulRequests,
    requests: value.requests + sample.totalRequests,
    latency: value.latency + sample.latencyMs,
  }), { successful: 0, requests: 0, latency: 0 });
  const averageLatencyMs = totals.latency / samples.length;
  return { availability: availability(totals.successful, totals.requests), errorRate: errorRate(totals.successful, totals.requests), averageLatencyMs, status: latencyStatus(averageLatencyMs) };
};
