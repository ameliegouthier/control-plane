import type { Signal, WorkflowWithSignals } from "../types";
import { getTriggerTypeFromNodes } from "../nodeUtils";

export function detectAlertSignals(
  workflow: WorkflowWithSignals,
): Signal[] {
  const nodes = Array.isArray(workflow.graph?.nodes) ? workflow.graph.nodes : [];

  const effectiveTriggerType =
    workflow.triggerType ?? getTriggerTypeFromNodes(nodes);
  const lastFailed = workflow.lastExecutionStatus === "error";
  const noTrigger =
    effectiveTriggerType === undefined ||
    effectiveTriggerType === "none" ||
    effectiveTriggerType === "";

  const signals: Signal[] = [];

  if (workflow.enrichment?.health === "broken" || lastFailed) {
    signals.push({
      type: "broken_workflow",
      category: "alerts",
      severity: 100,
      workflow: workflow.id,
    });
  }

  if (lastFailed) {
    signals.push({
      type: "failed_last_run",
      category: "alerts",
      severity: 90,
      workflow: workflow.id,
    });
  }

  if (noTrigger) {
    signals.push({
      type: "no_trigger",
      category: "alerts",
      severity: 85,
      workflow: workflow.id,
    });
  }

  // missing_credentials: no raw data for creds; skip emission for now

  return signals;
}

