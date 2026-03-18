import type { WorkflowWithFullEnrichment } from "@/lib/enrichment";
import type { WorkflowGraph } from "@/lib/providers/types";

/** Display categories for the debug page: Security, Alerts, Optimization. */
export type SignalCategory = "security" | "alerts" | "optimization";

/** Core signal types only. Low-value signals (inactive, warning, not run recently) removed. */
export type SignalType =
  // SECURITY
  | "public_webhook"
  | "missing_auth"
  | "external_webhook"
  // ALERTS
  | "broken_workflow"
  | "missing_credentials"
  | "failed_last_run"
  | "no_trigger"
  // OPTIMIZATION
  | "duplicate_workflow"
  | "fan_out_workflow"
  | "orphan_service"
  | "too_many_integrations"
  | "over_complex_workflow"
  | "duplicate_action"
  | "inefficient_chain";

export type Signal = {
  type: SignalType;
  category: SignalCategory;
  severity: number;
  workflow?: string;
  workflows?: string[];
  /** Optional workflow id (when emitting workflowId in examples). */
  workflowId?: string;
  /** Optional service name (for orphan_service, etc.). */
  service?: string;
  metadata?: Record<string, unknown>;
};

export type SignalSummary = "clean-workflow" | "signals-detected";

export type WorkflowWithSignals = WorkflowWithFullEnrichment & {
  /**
   * Normalized graph structure (nodes + edges). Required for signal detection.
   * Populated when merging normalized Workflow with enrichment data.
   */
  graph?: WorkflowGraph;
  /**
   * Structured detections produced by the automation analysis engine.
   */
  signals: Signal[];
  /** When no signals are detected, set to "clean-workflow" instead of "no-signal". */
  signalSummary?: SignalSummary;
};
