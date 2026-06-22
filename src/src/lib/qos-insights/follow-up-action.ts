export interface QosInsight {
  key: string;
  value: number;
  baseline: number;
  delta: number;
  interpretation: string;
}

/** Builds a normalized follow-up-action insight without mutating source telemetry. */
export const evaluate = (value: number, baseline = 0): QosInsight => {
  const delta = value - baseline;
  return {
    key: "follow-up-action",
    value,
    baseline,
    delta,
    interpretation: delta === 0 ? "stable" : delta > 0 ? "above baseline" : "below baseline",
  };
};
