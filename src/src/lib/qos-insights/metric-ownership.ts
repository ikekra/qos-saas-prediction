export interface QosInsight {
  key: string;
  value: number;
  baseline: number;
  delta: number;
  interpretation: string;
}

/** Builds a normalized metric-ownership insight without mutating source telemetry. */
export const evaluate = (value: number, baseline = 0): QosInsight => {
  const delta = value - baseline;
  return {
    key: "metric-ownership",
    value,
    baseline,
    delta,
    interpretation: delta === 0 ? "stable" : delta > 0 ? "above baseline" : "below baseline",
  };
};
