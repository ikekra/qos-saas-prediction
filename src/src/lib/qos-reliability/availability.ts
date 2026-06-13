import { clamp } from "./clamp";

export const availability = (successfulRequests: number, totalRequests: number): number => {
  if (totalRequests <= 0) return 0;
  return clamp((successfulRequests / totalRequests) * 100, 0, 100);
};
