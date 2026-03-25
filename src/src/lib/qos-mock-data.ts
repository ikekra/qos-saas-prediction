type ServiceStatus = "green" | "yellow" | "red";

export type QosStatusRow = {
  service: string;
  responseMs: number;
  uptime: number;
  errorRate: number;
  throughput: number;
  p50: number;
  p90: number;
  p99: number;
  slaBreaches: number;
  slaCompliance: number;
  status: ServiceStatus;
};

export type QosHeatmapCell = {
  hour: number;
  failures: number;
};

export const MOCK_QOS_ROWS: QosStatusRow[] = [
  { service: "api.auth.local", responseMs: 124, uptime: 99.95, errorRate: 0.3, throughput: 26, p50: 102, p90: 161, p99: 240, slaBreaches: 1, slaCompliance: 99.2, status: "green" },
  { service: "api.billing.local", responseMs: 210, uptime: 99.2, errorRate: 1.2, throughput: 19, p50: 168, p90: 270, p99: 380, slaBreaches: 3, slaCompliance: 97.9, status: "yellow" },
  { service: "api.notifications.local", responseMs: 320, uptime: 97.8, errorRate: 2.6, throughput: 13, p50: 250, p90: 410, p99: 620, slaBreaches: 6, slaCompliance: 95.1, status: "red" },
];

export function buildHeatmap(cells = 24): QosHeatmapCell[] {
  return Array.from({ length: cells }, (_, hour) => {
    const base = Math.sin((hour / 24) * Math.PI * 2);
    const failures = Math.max(0, Math.round((base + 1.2) * 2 + (hour >= 18 ? 2 : 0)));
    return { hour, failures };
  });
}

export function withFallbackRows(rows: QosStatusRow[]) {
  if (rows.length > 0) return rows;
  return MOCK_QOS_ROWS;
}

