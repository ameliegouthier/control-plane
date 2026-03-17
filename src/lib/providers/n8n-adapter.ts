/**
 * n8n Provider Adapter
 *
 * Handles fetching, normalizing, and syncing workflows from n8n instances.
 * Wraps existing n8n-specific logic into the provider adapter pattern.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { N8nClient, type N8nClientConfig } from "../n8n-client";
import type {
  ProviderAdapter,
  ProviderConnection,
  FetchWorkflowsResult,
  SyncWorkflowsResult,
  Workflow,
  WorkflowGraphNode,
  RawProviderWorkflow,
} from "./types";
import { syncWorkflowNodes } from "./sync-workflow-nodes";
import { generateWorkflowSummary, generateNodeSummary } from "../generateWorkflowSummary";
import {
  normalizeN8nNode,
  buildN8nEdges,
  buildGraph,
} from "./normalize-workflow";

// ─── n8n-specific types ────────────────────────────────────────────────────────

interface N8nNode {
  id?: string;
  name?: string;
  type: string;
  parameters?: Record<string, unknown>;
  position?: [number, number];
  [key: string]: unknown;
}

interface N8nWorkflow {
  id: string | number;
  name: string;
  active: boolean;
  nodes?: N8nNode[];
  connections?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ─── N8N Adapter Implementation ────────────────────────────────────────────────

export class N8NAdapter implements ProviderAdapter {
  readonly provider = "n8n" as const;

  /**
   * Fetch workflows from n8n API.
   */
  async fetchWorkflows(
    connection: ProviderConnection
  ): Promise<FetchWorkflowsResult> {
    const clientConfig = this.extractClientConfig(connection);
    if (!clientConfig) {
      return {
        success: false,
        workflows: [],
        error: "Invalid n8n connection configuration",
      };
    }

    try {
      const client = new N8nClient(clientConfig);
      const payload = (await client.getWorkflows()) as { data?: N8nWorkflow[] } | unknown;
      const workflows: N8nWorkflow[] =
        (payload && (payload as any).data) ?? [];

      return {
        success: true,
        workflows: workflows as RawProviderWorkflow[],
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error calling n8n API";
      return {
        success: false,
        workflows: [],
        error: message,
      };
    }
  }

  /**
   * Normalize an n8n workflow into the generic Workflow model with WorkflowGraph.
   * Uses the shared normalization layer (normalize-workflow.ts) so n8n and Make
   * produce the same normalized node shape (id, label, service, action?, kind, type).
   */
  normalizeWorkflow(
    raw: RawProviderWorkflow,
    connectionId: string
  ): Workflow | null {
    const n8nWorkflow = raw as N8nWorkflow;

    if (!n8nWorkflow.id || !n8nWorkflow.name) {
      return null;
    }

    const rawNodes = n8nWorkflow.nodes ?? [];
    const workflowExternalId = String(n8nWorkflow.id);

    const normalizedNodes = rawNodes.map((n, index) =>
      normalizeN8nNode(n, index, workflowExternalId)
    );

    const nameToId = new Map<string, string>();
    for (const node of normalizedNodes) {
      nameToId.set(node.label, node.id);
    }

    const connections = n8nWorkflow.connections as Record<string, {
      main?: Array<Array<{ node: string; type: string; index: number }>>;
    }> | undefined;
    const edges = buildN8nEdges(connections, nameToId);
    const graph = buildGraph(normalizedNodes, edges);

    const providerWorkflowId = String(n8nWorkflow.id);
    return {
      id: providerWorkflowId, // Sync uses this only to fill config.externalId; UI gets DB id from repository
      externalId: providerWorkflowId,
      name: n8nWorkflow.name,
      active: n8nWorkflow.active ?? false,
      provider: "n8n",
      connectionId,
      graph,
      updatedAt: n8nWorkflow.updatedAt ?? new Date().toISOString(),
      createdAt: n8nWorkflow.createdAt ?? new Date().toISOString(),
    };
  }

  /**
   * Sync workflows from n8n to the database.
   * Returns the raw payload for backward compatibility with API routes.
   */
  async syncWorkflows(
    connection: ProviderConnection
  ): Promise<SyncWorkflowsResult & { rawPayload?: unknown }> {
    const fetchResult = await this.fetchWorkflows(connection);

    if (!fetchResult.success) {
      await this.logSync(
        connection.id,
        connection.userId,
        "ERROR",
        0,
        fetchResult.error ?? "Failed to fetch workflows"
      );
      return {
        success: false,
        synced: 0,
        error: fetchResult.error,
      };
    }

    const rawWorkflows = fetchResult.workflows as N8nWorkflow[];
    let synced = 0;

    try {
      for (const rawWf of rawWorkflows) {
        const normalized = this.normalizeWorkflow(rawWf, connection.id);
        if (!normalized) continue;

        // Find trigger node for metadata
        const triggerNode = normalized.graph?.nodes.find((n) => {
          const t = n.type.toLowerCase();
          return t.includes("trigger") || t.includes("webhook");
        });

        const triggerConfig = triggerNode
          ? ({} as Prisma.InputJsonValue) // Parameters stored separately if needed
          : Prisma.JsonNull;

        // Store graph structure in actions field for backward compatibility
        // Convert WorkflowGraph back to legacy format for DB storage
        const legacyNodes = normalized.graph?.nodes.map((n) => ({
          id: n.id,
          name: n.label,
          type: n.type,
          position: [0, 0] as [number, number],
        })) ?? [];

        const legacyConnections: Record<string, {
          main: Array<Array<{ node: string; type: string; index: number }>>;
        }> = {};
        
        if (normalized.graph) {
          for (const edge of normalized.graph.edges) {
            if (!legacyConnections[edge.from]) {
              legacyConnections[edge.from] = { main: [] };
            }
            legacyConnections[edge.from].main.push([{
              node: edge.to,
              type: "main",
              index: 0,
            }]);
          }
        }

        const actions = {
          nodes: legacyNodes,
          connections: legacyConnections,
          graph: normalized.graph, // Also store new format for future use
        };

        // Upsert workflow in database (Integration model: use integrationId, store actions in config)
        const integrationId = connection.id;
        const workflowConfig = {
          provider: normalized.provider,
          externalId: normalized.externalId ?? normalized.id,
          actions,
          triggerConfig,
          // Debug-only: keep a snapshot of the original provider payload.
          rawProviderWorkflow: rawWf,
        } as Prisma.InputJsonValue;

        const existing = await prisma.workflow.findFirst({
          where: { integrationId, name: normalized.name },
        });

        const workflowData = {
          name: normalized.name,
          status: normalized.active ? "active" : "inactive",
          triggerType: triggerNode?.type ?? undefined,
          config: workflowConfig,
        };

        let workflowId: string;
        if (existing) {
          await prisma.workflow.update({
            where: { id: existing.id },
            data: workflowData,
          });
          workflowId = existing.id;
        } else {
          const created = await prisma.workflow.create({
            data: {
              userId: connection.userId,
              integrationId,
              ...workflowData,
            },
          });
          workflowId = created.id;
        }

        const syncedNodes = await syncWorkflowNodes(workflowId, normalized.graph);

        for (const node of syncedNodes) {
          if (node.aiSummary === null) {
            const summary = await generateNodeSummary(node, normalized.name);
            await prisma.workflowNode.update({
              where: { id: node.id },
              data: { aiSummary: summary },
            });
          }
        }

        // Generate AI summary only once (when aiSummary is not yet set)
        const saved = await prisma.workflow.findUnique({
          where: { id: workflowId },
          select: { aiSummary: true },
        });
        if (saved?.aiSummary === null) {
          const actionNode = normalized.graph?.nodes.find((n) => n.kind === "action" && n.service);
          const resourceName = actionNode?.service ?? normalized.name;
          const summary = await generateWorkflowSummary(normalized, resourceName);
          await prisma.workflow.update({
            where: { id: workflowId },
            data: { aiSummary: summary },
          });
        }

        synced++;
      }

      await prisma.integration.update({
        where: { id: connection.id },
        data: { updatedAt: new Date() },
      });

      await this.logSync(connection.id, connection.userId, "SUCCESS", synced, null);

      // Return raw payload for backward compatibility
      return {
        success: true,
        synced,
        rawPayload: { data: rawWorkflows },
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error syncing workflows";
      await this.logSync(connection.id, connection.userId, "ERROR", 0, message).catch(
        () => {}
      );
      return {
        success: false,
        synced: 0,
        error: message,
      };
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private extractClientConfig(connection: ProviderConnection): N8nClientConfig | null {
    const config = connection.config as Record<string, string>;
    if (!config.baseUrl) return null;

    return {
      baseUrl: config.baseUrl,
      apiPath: config.apiPath,
      apiKey: config.apiKey,
    };
  }

  private async logSync(
    integrationId: string,
    userId: string,
    status: "SUCCESS" | "PARTIAL" | "ERROR",
    workflowsCount: number,
    errorMessage: string | null
  ) {
    await prisma.syncLog.create({
      data: {
        integrationId,
        userId,
        status,
        details: { workflowsCount },
        errorMessage,
      },
    });
  }
}
