import type { Signal, WorkflowWithSignals } from "../types";
import type { WorkflowContext } from "../workflowContext";
import {
  extractIntegrationCountFromNodes,
  getTriggerTypeFromNodes,
  hasDuplicateActionInNodes,
} from "../nodeUtils";

export function detectOptimizationSignals(
  workflow: WorkflowWithSignals,
  context: WorkflowContext,
): Signal[] {
  const nodes = Array.isArray(workflow.graph?.nodes) ? workflow.graph.nodes : [];
  const effectiveNodesCount = nodes.length;
  const effectiveTriggerType =
    workflow.triggerType ?? getTriggerTypeFromNodes(nodes);
  const integrationCount =
    nodes.length > 0
      ? extractIntegrationCountFromNodes(nodes)
      : (workflow.enrichment?.systems?.length ?? 0);

  const signals: Signal[] = [];

  // RULE 1 — duplicate_workflow (structural fingerprint on node sequence).
  const fingerprint = context.workflowIdToFingerprint.get(workflow.id);
  if (fingerprint) {
    const groupIds = context.fingerprints.get(fingerprint) ?? [];
    if (groupIds.length > 1) {
      const allIds = Array.from(new Set(groupIds)).sort();
      signals.push({
        type: "duplicate_workflow",
        category: "optimization",
        severity: 68,
        workflows: allIds,
      });
    }
  }

  // RULE 2 — fan_out_workflow (too many destinations).
  const fanOutCount = context.fanOutByWorkflowId.get(workflow.id) ?? 0;
  if (fanOutCount > 3) {
    signals.push({
      type: "fan_out_workflow",
      category: "optimization",
      severity: 55,
      workflow: workflow.id,
      workflowId: workflow.id,
    });
  }

  // RULE 3 — orphan_service (services used by only one workflow).
  const orphanServices =
    context.orphanServicesByWorkflowId.get(workflow.id) ?? [];
  for (const service of orphanServices) {
    signals.push({
      type: "orphan_service",
      category: "optimization",
      severity: 40,
      workflow: workflow.id,
      workflowId: workflow.id,
      service,
    });
  }

  if (integrationCount >= 4) {
    signals.push({
      type: "too_many_integrations",
      category: "optimization",
      severity: 50,
      workflow: workflow.id,
    });
  }

  if (effectiveNodesCount > 8) {
    signals.push({
      type: "over_complex_workflow",
      category: "optimization",
      severity: 60,
      workflow: workflow.id,
    });
  }

  if (hasDuplicateActionInNodes(nodes)) {
    signals.push({
      type: "duplicate_action",
      category: "optimization",
      severity: 55,
      workflow: workflow.id,
    });
  }

  if (effectiveTriggerType === "polling") {
    signals.push({
      type: "inefficient_chain",
      category: "optimization",
      severity: 60,
      workflow: workflow.id,
    });
  }

  return signals;
}

