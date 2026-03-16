/**
 * Persist workflow graph nodes to the WorkflowNode table.
 * Used by n8n and make adapters after upserting a workflow.
 * Reads from the normalized graph (config.actions.graph.nodes) and writes
 * one WorkflowNode row per node. Existing nodes for the workflow are deleted first.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { WorkflowGraph, WorkflowGraphNode } from "./types";

/**
 * Sync nodes from a workflow graph to the WorkflowNode table.
 * - Deletes all existing WorkflowNode rows for the given workflowId.
 * - Creates one row per node with: workflowId, type, name (label), position, config (externalId, kind).
 */
export async function syncWorkflowNodes(
  workflowId: string,
  graph: WorkflowGraph | undefined
): Promise<number> {
  const nodes = graph?.nodes ?? [];
  if (nodes.length === 0) {
    await prisma.workflowNode.deleteMany({ where: { workflowId } });
    return 0;
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

  const result = await prisma.workflowNode.createMany({
    data: createData,
  });

  return result.count;
}
