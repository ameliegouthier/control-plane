import type { Signal, SignalSummary, WorkflowWithSignals } from "./types";
import { buildWorkflowContext } from "./workflowContext";
import { detectSecuritySignals } from "./rules/securityRules";
import { detectAlertSignals } from "./rules/alertRules";
import { detectOptimizationSignals } from "./rules/optimizationRules";

export type DetectSignalsOptions = {
  idToProvider?: Map<string, string>;
};

export function detectSignals(
  workflows: WorkflowWithSignals[],
  // Options kept for API compatibility; currently unused.
  _options: DetectSignalsOptions = {},
): WorkflowWithSignals[] {
  if (process.env.NODE_ENV === "development") {
    for (const wf of workflows) {
      const graph = (wf as { graph?: { nodes?: unknown[] } }).graph;
      if (
        !graph?.nodes ||
        !Array.isArray(graph.nodes) ||
        graph.nodes.length === 0
      ) {
        throw new Error(
          `Workflow ${wf.id} not normalized before signal detection`,
        );
      }
    }
  }

  const context = buildWorkflowContext(workflows);

  return workflows.map((workflow) => {
    const securitySignals = detectSecuritySignals(workflow);
    const alertSignals = detectAlertSignals(workflow);
    const optimizationSignals = detectOptimizationSignals(workflow, context);

    const signals: Signal[] = [
      ...securitySignals,
      ...alertSignals,
      ...optimizationSignals,
    ];

    const signalSummary: SignalSummary =
      signals.length === 0 ? "clean-workflow" : "signals-detected";

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("OPTIMIZATION_DEBUG: signals detected", {
        workflowId: workflow.id,
        signals,
      });
    }

    return {
      ...workflow,
      signals,
      signalSummary,
    };
  });
}

export type { Signal, SignalSummary, WorkflowWithSignals } from "./types";

