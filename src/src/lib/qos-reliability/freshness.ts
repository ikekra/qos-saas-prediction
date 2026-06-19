export const isFreshMeasurement = (observedAt: string, maxAgeMinutes = 15): boolean => {
  const age = Date.now() - new Date(observedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age <= maxAgeMinutes * 60_000;
};
