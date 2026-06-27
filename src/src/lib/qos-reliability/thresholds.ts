export const qosThresholds = {
  healthyLatencyMs: 600,
  criticalLatencyMs: 1200,
  warningErrorRate: 2,
  criticalErrorRate: 5,
  warningAvailability: 99,
  criticalAvailability: 97,
} as const;
