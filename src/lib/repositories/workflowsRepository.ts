/**
 * Single source of truth for workflow data.
 *
 * This repository provides the only entry point for workflow data.
 * All pages (Dashboard, Overview, etc.) must use this repository.
 *
 * In demo mode, returns DEMO_WORKFLOWS.
 * In live mode, reads workflows from the database (via Prisma).
 */

import { DEMO_WORKFLOWS, type WorkflowWithEnrichmentFields } from "@/lib/demo/demoWorkflows";
import type { Workflow } from "@/app/workflow-helpers";
import { toWorkflow } from "@/app/workflow-helpers";
import type { RawWorkflow } from "@/lib/enrichment";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

function safeConfigExternalId(dbWorkflow: unknown): string | undefined {
  try {
    const cfg = (dbWorkflow as { config?: unknown })?.config as
      | Record<string, unknown>
      | undefined
      | null;
    const val = cfg?.externalId;
    return typeof val === "string" ? val : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Convert a WorkflowWithEnrichmentFields (demo) to RawWorkflow format (for enrichment).
 */
function demoWorkflowToRawWorkflow(wf: WorkflowWithEnrichmentFields): RawWorkflow {
  // Convert WorkflowGraph nodes to legacy format for enrichment
  const nodes =
    wf.graph?.nodes.map((n) => ({
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
    destination: wf.outputDestination,
    healthOverride: wf.healthOverride,
  };
}

/** Derive triggerType and hasPublicWebhook from graph nodes for live workflows. */
function deriveTriggerMetadata(
  nodes: Array<{ type?: string; label?: string }>,
): { triggerType?: string; hasPublicWebhook?: boolean } {
  const trigger = nodes.find((n) => {
    const t = (n.type ?? "").toLowerCase();
    return t.includes("trigger") || t.includes("webhook");
  });
  if (!trigger) return {};
  const type = (trigger.type ?? "").toLowerCase();
  const hasPublicWebhook = type.includes("webhook");
  let triggerType: string | undefined;
  if (type.includes("polling")) triggerType = "polling";
  else if (type.includes("webhook")) triggerType = "webhook";
  else if (type.includes("schedule") || type.includes("cron")) triggerType = "schedule";
  else if (type.includes("trigger")) triggerType = "trigger";
  return { triggerType, hasPublicWebhook };
}

/**
 * Convert a generic Workflow (typically from DB) to RawWorkflow format.
 * Derives triggerType, hasPublicWebhook, and nodes from workflow.graph.nodes
 * so signal detection and enrichment work for live n8n/Make workflows.
 */
function dbWorkflowToRawWorkflow(wf: Workflow): RawWorkflow {
  const nodes =
    wf.graph?.nodes.map((n) => ({
      id: n.id,
      name: n.label,
      type: n.type,
    })) ?? [];

  const { triggerType, hasPublicWebhook } = deriveTriggerMetadata(nodes);

  return {
    id: wf.id,
    name: wf.name,
    active: wf.active,
    nodesCount: nodes.length,
    nodes,
    triggerType,
    hasPublicWebhook,
    aiSummary: wf.aiSummary ?? null,
  };
}

// ─── Demo data helpers (DEMO_WORKFLOWS) ────────────────────────────────────────

/**
 * Get all demo workflows (DEMO_WORKFLOWS).
 *
 * @returns Workflow[] - Generic workflow model with enrichment fields
 */
export function getAllWorkflows(): Workflow[] {
  return DEMO_WORKFLOWS;
}

/**
 * Get all demo workflows as RawWorkflow format (for enrichment).
 */
export function getAllWorkflowsAsRaw(): RawWorkflow[] {
  return DEMO_WORKFLOWS.map(demoWorkflowToRawWorkflow);
}

/**
 * Get a single demo workflow by ID.
 */
export function getWorkflowById(id: string): Workflow | null {
  return DEMO_WORKFLOWS.find((w) => w.id === id) ?? null;
}

/**
 * Get demo workflows filtered by provider.
 */
export function getWorkflowsByProvider(provider: string): Workflow[] {
  return DEMO_WORKFLOWS.filter((w) => w.provider === provider);
}

// ─── Live data helpers (database) ─────────────────────────────────────────────

/**
 * Load all workflows for the demo user from the database.
 * This is the live data source used when demo mode is disabled.
 */
export async function getAllWorkflowsFromDatabase(): Promise<Workflow[]> {
  const user = await getDemoUser();
  const dbWorkflows = await prisma.workflow.findMany({
    where: { userId: user.id },
    include: { integration: true, workflowNodes: true, insights: true },
    orderBy: { updatedAt: "desc" },
  });
  return dbWorkflows.map((dbWf) => {
    const workflow = toWorkflow(dbWf);
    if (workflow.graph && dbWf.workflowNodes.length > 0) {
      const summaryByExternalId = new Map<string, string | null>(
        dbWf.workflowNodes.map((n) => [
          (n.config as Record<string, unknown> | null)?.externalId as string | undefined ?? "",
          n.aiSummary,
        ])
      );
      workflow.graph = {
        ...workflow.graph,
        nodes: workflow.graph.nodes.map((n) => ({
          ...n,
          aiSummary: summaryByExternalId.get(n.id) ?? null,
        })),
      };
    }
    workflow.insights = dbWf.insights.map((i) => ({
      id: i.id,
      type: i.type,
      severity: i.severity,
      title: i.title,
      description: i.description,
      fix: i.fix,
    }));
    return workflow;
  });
}

/**
 * Load a single workflow by ID for the demo user from the database.
 * The id must be the database Workflow.id (canonical); provider ids must not be used.
 */
export async function getWorkflowByIdFromDatabase(id: string): Promise<Workflow | null> {
  const all = await getAllWorkflowsFromDatabase();
  return all.find((w) => w.id === id) ?? null;
}

/**
 * Load all workflows for the demo user as RawWorkflow format from the database.
 */
export async function getAllWorkflowsFromDatabaseAsRaw(): Promise<RawWorkflow[]> {
  const workflows = await getAllWorkflowsFromDatabase();
  return workflows.map(dbWorkflowToRawWorkflow);
}

