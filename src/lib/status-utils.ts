/**
 * Status and health utilities for dashboard UI.
 */

import type { HealthStatus } from "@/lib/enrichment";

const HEALTH_SCORE: Record<HealthStatus, number> = {
  ok: 100,
  optimizable: 80,
  warning: 60,
  broken: 20,
};

export function computeSystemHealth(healthValues: HealthStatus[]): number {
  if (healthValues.length === 0) return 0;
  const total = healthValues.reduce((sum, h) => sum + (HEALTH_SCORE[h] ?? 0), 0);
  return Math.round(total / healthValues.length);
}

export function getHealthLabel(status: HealthStatus): string {
  switch (status) {
    case "ok":
      return "OK";
    case "warning":
      return "Warning";
    case "broken":
      return "Broken";
    case "optimizable":
      return "Optimizable";
    default:
      return "Unknown";
  }
}

export function getHealthVariant(status: HealthStatus): "success" | "warning" | "error" | "neutral" {
  switch (status) {
    case "ok":
      return "success";
    case "optimizable":
      return "neutral";
    case "warning":
      return "warning";
    case "broken":
      return "error";
    default:
      return "neutral";
  }
}
