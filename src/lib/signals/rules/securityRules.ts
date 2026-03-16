import type { Signal, WorkflowWithSignals } from "../types";
import {
  hasExternalCallInNodes,
  hasPublicWebhookInNodes,
} from "../nodeUtils";

export function detectSecuritySignals(
  workflow: WorkflowWithSignals,
): Signal[] {
  const nodes = Array.isArray(workflow.graph?.nodes) ? workflow.graph.nodes : [];

  const effectiveHasPublicWebhook =
    workflow.hasPublicWebhook === true || hasPublicWebhookInNodes(nodes);

  const signals: Signal[] = [];

  if (effectiveHasPublicWebhook) {
    signals.push({
      type: "public_webhook",
      category: "security",
      severity: 80,
      workflow: workflow.id,
    });
    // Webhook without auth node / auth config → missing_auth (best-effort)
    signals.push({
      type: "missing_auth",
      category: "security",
      severity: 75,
      workflow: workflow.id,
    });
  }

  if (effectiveHasPublicWebhook && hasExternalCallInNodes(nodes)) {
    signals.push({
      type: "external_webhook",
      category: "security",
      severity: 70,
      workflow: workflow.id,
    });
  }

  return signals;
}

