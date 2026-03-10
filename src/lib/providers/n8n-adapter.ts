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
  WorkflowGraph,
  WorkflowGraphNode,
  WorkflowGraphEdge,
  RawProviderWorkflow,
} from "./types";
import { extractNotionDatabaseId } from "./notion-resources";

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
   */
  normalizeWorkflow(
    raw: RawProviderWorkflow,
    connectionId: string
  ): Workflow | null {
    const n8nWorkflow = raw as N8nWorkflow;

    if (!n8nWorkflow.id || !n8nWorkflow.name) {
      return null;
    }

    // Normalize nodes to WorkflowGraph format (including external resource IDs)
    const rawNodes = n8nWorkflow.nodes ?? [];
    const graphNodes: WorkflowGraphNode[] = rawNodes.map((n, index) => {
      const nodeId = n.id ?? `node_${index}`;
      const nodeName = n.name ?? `Node ${index}`;
      const nodeType = n.type ?? "unknown";
      const typeLower = nodeType.toLowerCase();
      
      // Determine node kind based on type
      let kind: "trigger" | "action" | "router" | "other" = "other";
      if (typeLower.includes("trigger") || typeLower.includes("webhook")) {
        kind = "trigger";
      } else if (typeLower.includes("if") || typeLower.includes("switch") || typeLower.includes("router")) {
        kind = "router";
      } else if (!typeLower.includes("trigger")) {
        kind = "action";
      }

      const base: WorkflowGraphNode = {
        id: nodeId,
        label: nodeName,
        kind,
        type: nodeType,
      };

      if (typeLower.includes("notion")) {
        const databaseId = extractNotionDatabaseId(n);
        if (databaseId) base.databaseId = databaseId;
      }
      if (typeLower.includes("slack")) {
        const params = n.parameters ?? {};
        const channel = params.channel;
        if (typeof channel === "string" && channel) base.channelId = channel;
      }

      return base;
    });

    // Normalize connections to WorkflowGraph edges
    // Create mapping from node name to node ID
    const nameToId = new Map<string, string>();
    for (const node of graphNodes) {
      // Find the original node by matching label to name
      const originalNode = rawNodes.find((n) => (n.name ?? "") === node.label);
      if (originalNode) {
        const originalName = originalNode.name ?? "";
        nameToId.set(originalName, node.id);
      }
    }

    const edges: WorkflowGraphEdge[] = [];
    const connections = n8nWorkflow.connections as Record<string, {
      main?: Array<Array<{ node: string; type: string; index: number }>>;
    }> | undefined;

    if (connections) {
      for (const [sourceNodeName, conn] of Object.entries(connections)) {
        const sourceId = nameToId.get(sourceNodeName);
        if (!sourceId) continue;
        
        const mainConnections = conn.main ?? [];
        for (const slot of mainConnections) {
          for (const edge of slot) {
            const targetId = nameToId.get(edge.node);
            if (targetId) {
              edges.push({
                from: sourceId,
                to: targetId,
              });
            }
          }
        }
      }
    }

    const graph: WorkflowGraph = {
      nodes: graphNodes,
      edges,
    };

    return {
      id: String(n8nWorkflow.id),
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
          externalId: normalized.id,
          actions,
          triggerConfig,
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

        if (existing) {
          await prisma.workflow.update({
            where: { id: existing.id },
            data: workflowData,
          });
        } else {
          await prisma.workflow.create({
            data: {
              userId: connection.userId,
              integrationId,
              ...workflowData,
            },
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
