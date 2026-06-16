import { clamp } from "./clamp";

export const errorRate = (successfulRequests: number, totalRequests: number): number => {
  if (totalRequests <= 0) return 0;
  return clamp(((totalRequests - successfulRequests) / totalRequests) * 100, 0, 100);
};
