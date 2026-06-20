export type Trend = "improving" | "stable" | "degrading";

export const latencyTrend = (previousMs: number, currentMs: number): Trend => {
  const difference = currentMs - previousMs;
  if (Math.abs(difference) < 25) return "stable";
  return difference < 0 ? "improving" : "degrading";
};
