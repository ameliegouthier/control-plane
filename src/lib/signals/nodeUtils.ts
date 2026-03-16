import type { WorkflowWithSignals } from "./types";

/**
 * All helpers that operate directly on workflow nodes live here so that
 * security, alert and optimization rules can share them without duplicating
 * logic. The implementations are copied from the original signal engine to
 * preserve behavior.
 */

/** Extract unique integration/service count from workflow.nodes (n8n/Make node types). */
export function extractIntegrationCountFromNodes(nodes: unknown[]): number {
  const services = new Set<string>();
  for (const n of nodes) {
    if (n == null || typeof n !== "object") continue;
    const type = (n as { type?: string }).type;
    if (typeof type !== "string" || !type.trim()) continue;
    const lower = type.toLowerCase();
    const parts = lower.split(/[.:]/);
    const last = parts[parts.length - 1];
    if (last && last !== "trigger" && last !== "webhook") {
      services.add(last);
    }
  }
  return services.size;
}

/** Derive trigger type from first trigger-like node in nodes. */
export function getTriggerTypeFromNodes(
  nodes: WorkflowWithSignals["nodes"] | unknown[],
): string | undefined {
  for (const n of nodes as unknown[]) {
    if (n == null || typeof n !== "object") continue;
    const type = (n as { type?: string }).type ?? "";
    const t = type.toLowerCase();
    if (!t.includes("trigger") && !t.includes("webhook")) continue;
    if (t.includes("polling")) return "polling";
    if (t.includes("webhook")) return "webhook";
    if (t.includes("schedule") || t.includes("cron")) return "schedule";
    return "trigger";
  }
  return undefined;
}

/** Detect public webhook from nodes (any webhook trigger node). */
export function hasPublicWebhookInNodes(nodes: unknown[]): boolean {
  for (const n of nodes) {
    if (n == null || typeof n !== "object") continue;
    const type = (n as { type?: string }).type ?? "";
    if (type.toLowerCase().includes("webhook")) return true;
  }
  return false;
}

/** True if nodes include an HTTP request / external call (e.g. n8n httpRequest, make.http). */
export function hasExternalCallInNodes(nodes: unknown[]): boolean {
  for (const n of nodes) {
    if (n == null || typeof n !== "object") continue;
    const type = ((n as { type?: string }).type ?? "").toLowerCase();
    if (type.includes("http") || type.includes("request")) return true;
  }
  return false;
}

/** Detect duplicate action: same service+operation repeated (simple heuristic). */
export function hasDuplicateActionInNodes(nodes: unknown[]): boolean {
  const keys = new Set<string>();
  for (const n of nodes) {
    if (n == null || typeof n !== "object") continue;
    const type = (n as { type?: string }).type;
    if (typeof type !== "string") continue;
    const lower = type.toLowerCase();
    const parts = lower.split(/[.:]/);
    const last = parts[parts.length - 1];
    if (last && last !== "trigger" && last !== "webhook") {
      const key = last;
      if (keys.has(key)) return true;
      keys.add(key);
    }
  }
  return false;
}

