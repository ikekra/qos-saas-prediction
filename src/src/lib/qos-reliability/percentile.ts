import { clamp } from "./clamp";

export const percentile = (values: number[], ratio: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(clamp(ratio, 0, 1) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};
