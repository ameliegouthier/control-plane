/**
 * Single source of truth for workflow data.
 *
 * This repository provides the only entry point for workflow data.
 * All pages (Dashboard, Overview, etc.) must use this repository.
 *
 * In demo mode, returns DEMO_WORKFLOWS.
 * In production, will fetch from database/API.
 */

import { DEMO_WORKFLOWS, type WorkflowWithEnrichmentFields } from "@/lib/demo/demoWorkflows";
import type { Workflow } from "@/app/workflow-helpers";
import type { RawWorkflow } from "@/lib/enrichment";

/**
 * Convert a WorkflowWithEnrichmentFields to RawWorkflow format (for enrichment).
 */
function workflowToRawWorkflow(wf: WorkflowWithEnrichmentFields): RawWorkflow {
  // Convert WorkflowGraph nodes to legacy format for enrichment
  const nodes = wf.graph?.nodes.map((n) => ({
    id: n.id,
    name: n.label,
    type: n.type,
  })) ?? [];

  return {
    id: wf.id,
    name: wf.name,
    active: wf.active,
    triggerType: wf.triggerType,
    nodesCount: wf.nodesCount ?? nodes.length,
    hasPublicWebhook: wf.hasPublicWebhook,
    lastExecutionStatus: wf.lastExecutionStatus,
    lastExecutionDate: wf.lastExecutionDate,
    nodes,
  };
}

/**
 * Get all workflows.
 * This is the single entry point for workflow data.
 *
 * @returns Workflow[] - Generic workflow model with enrichment fields
 */
export function getAllWorkflows(): Workflow[] {
  return DEMO_WORKFLOWS;
}

/**
 * Get all workflows as RawWorkflow format (for enrichment).
 */
export function getAllWorkflowsAsRaw(): RawWorkflow[] {
  return DEMO_WORKFLOWS.map(workflowToRawWorkflow);
}

/**
 * Get a single workflow by ID.
 */
export function getWorkflowById(id: string): Workflow | null {
  return DEMO_WORKFLOWS.find((w) => w.id === id) ?? null;
}

/**
 * Get workflows filtered by provider.
 */
export function getWorkflowsByProvider(provider: string): Workflow[] {
  return DEMO_WORKFLOWS.filter((w) => w.provider === provider);
}
