/**
 * Workflow helpers – re-exported from app layer for shared use.
 * Implementation lives in app/workflow-helpers (Prisma/toWorkflow and graph helpers).
 */

export {
  toWorkflow,
  getTriggerNode,
  getTriggerLabel,
  formatNodeType,
  getTriggerSummary,
  getActionPills,
  getWorkflowRoute,
  getWorkflowPipeline,
  getSignals,
  buildMiniMap,
} from "@/app/workflow-helpers";
export type {
  Workflow,
  WorkflowGraph,
  WorkflowGraphNode,
  WorkflowGraphEdge,
  AutomationProvider,
  MiniMap,
  MiniMapNode,
  TriggerSummary,
  ActionPills,
  Signals,
  PipelineNode,
  PipelineNodeCategory,
} from "@/app/workflow-helpers";
