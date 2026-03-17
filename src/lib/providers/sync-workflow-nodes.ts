/**
 * Persist workflow graph nodes to the WorkflowNode table.
 * Used by n8n and make adapters after upserting a workflow.
 * Reads from the normalized graph (config.actions.graph.nodes) and writes
 * one WorkflowNode row per node. Existing nodes for the workflow are deleted first.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { WorkflowGraph, WorkflowGraphNode } from "./types";

export type SyncedWorkflowNode = {
  id: string;
  type: string;
  name: string | null;
  config: unknown;
  aiSummary: string | null;
};

/**
 * Sync nodes from a workflow graph to the WorkflowNode table.
 * - Deletes all existing WorkflowNode rows for the given workflowId.
 * - Creates one row per node with: workflowId, type, name (label), position, config (externalId, kind).
 * - Returns the created nodes (fetched after createMany to expose their DB ids).
 */
export async function syncWorkflowNodes(
  workflowId: string,
  graph: WorkflowGraph | undefined
): Promise<SyncedWorkflowNode[]> {
  const nodes = graph?.nodes ?? [];
  if (nodes.length === 0) {
    await prisma.workflowNode.deleteMany({ where: { workflowId } });
    return [];
  }

  await prisma.workflowNode.deleteMany({ where: { workflowId } });

  const createData: Prisma.WorkflowNodeCreateManyInput[] = nodes.map(
    (node: WorkflowGraphNode, index: number) => ({
      workflowId,
      type: node.type ?? "unknown",
      name: node.label ?? undefined,
      position: index,
      config: {
        externalId: node.id,
        kind: node.kind,
        provider: node.provider,
        service: node.service,
        operation: node.operation ?? node.action,
        action: node.action,
        category: node.category,
        ...(node.databaseId != null && { databaseId: node.databaseId }),
        ...(node.channelId != null && { channelId: node.channelId }),
      } as Prisma.InputJsonValue,
    })
  );

  await prisma.workflowNode.createMany({ data: createData });

  return prisma.workflowNode.findMany({
    where: { workflowId },
    orderBy: { position: "asc" },
    select: { id: true, type: true, name: true, config: true, aiSummary: true },
  });
}
