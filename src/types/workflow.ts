/**
 * Shared workflow types for the Control Plane dashboard.
 * Re-exports from provider layer for a single source of truth.
 */

export type {
  Workflow,
  WorkflowCore,
  WorkflowGraph,
  WorkflowGraphNode,
  WorkflowGraphEdge,
} from "@/lib/providers/types";
