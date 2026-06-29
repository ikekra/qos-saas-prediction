import type { ReliabilitySummary } from "./types";

export const reliabilityRecommendation = (summary: ReliabilitySummary): string => {
  if (summary.status === "critical") return "Prioritize incident review and reduce response latency before expanding traffic.";
  if (summary.status === "warning") return "Monitor the next test run and review slow endpoints or recent configuration changes.";
  return "Current reliability signals are healthy; retain the scheduled monitoring cadence.";
};
