/**
 * n8n Provider Adapter
 *
 * Handles fetching, normalizing, and syncing workflows from n8n instances.
 * Wraps existing n8n-specific logic into the provider adapter pattern.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { fetchN8nApi, type N8nCredentials } from "../n8n-client";
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
    const credentials = this.extractCredentials(connection);
    if (!credentials) {
      return {
        success: false,
        workflows: [],
        error: "Invalid n8n connection configuration",
      };
    }

    try {
      const res = await fetchN8nApi(credentials, "/workflows");

      if (!res.ok) {
        return {
          success: false,
          workflows: [],
          error: `n8n API responded with status ${res.status}`,
        };
      }

      const payload = await res.json();
      const workflows: N8nWorkflow[] = payload.data ?? [];

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

    // Normalize nodes to WorkflowGraph format
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

      return {
        id: nodeId,
        label: nodeName,
        kind,
        type: nodeType,
      };
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
        } as Prisma.InputJsonValue;

        // Upsert workflow in database
        // Use new provider-agnostic unique constraint (provider, externalId)
        const upsertData = {
          userId: connection.userId,
          connectionId: connection.id,
          provider: normalized.provider,
          externalId: normalized.id,
          toolWorkflowId: normalized.id, // Keep for backward compatibility during migration
          name: normalized.name,
          status: normalized.active ? "active" : "inactive",
          triggerType: triggerNode?.type ?? undefined,
          triggerConfig,
          actions,
          lastSyncedAt: new Date(),
        };

        // Check if workflow exists by new unique constraint
        const existing = await prisma.workflow.findUnique({
          where: {
            provider_externalId: {
              provider: normalized.provider,
              externalId: normalized.id,
            },
          },
        });

        if (existing) {
          // Update existing workflow
          await prisma.workflow.update({
            where: {
              provider_externalId: {
                provider: normalized.provider,
                externalId: normalized.id,
              },
            },
            data: {
              name: normalized.name,
              status: normalized.active ? "active" : "inactive",
              triggerType: triggerNode?.type ?? undefined,
              triggerConfig,
              actions,
              connectionId: connection.id, // Update connection if it changed
              lastSyncedAt: new Date(),
            },
          });
        } else {
          // Check if exists by legacy constraint (for migration)
          const legacyExisting = await prisma.workflow.findUnique({
            where: {
              connectionId_toolWorkflowId: {
                connectionId: connection.id,
                toolWorkflowId: normalized.id,
              },
            },
          });

          if (legacyExisting) {
            // Update legacy workflow with new fields
            await prisma.workflow.update({
              where: {
                connectionId_toolWorkflowId: {
                  connectionId: connection.id,
                  toolWorkflowId: normalized.id,
                },
              },
              data: {
                provider: normalized.provider,
                externalId: normalized.id,
                name: normalized.name,
                status: normalized.active ? "active" : "inactive",
                triggerType: triggerNode?.type ?? undefined,
                triggerConfig,
                actions,
                lastSyncedAt: new Date(),
              },
            });
          } else {
            // Create new workflow
            await prisma.workflow.create({
              data: upsertData,
            });
          }
        }

        synced++;
      }

      // Update connection lastSyncedAt
      await prisma.connection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: new Date() },
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

  private extractCredentials(connection: ProviderConnection): N8nCredentials | null {
    const config = connection.config as Record<string, string>;
    if (!config.baseUrl) return null;

    return {
      baseUrl: config.baseUrl,
      apiPath: config.apiPath ?? "/rest",
    };
  }

  private async logSync(
    connectionId: string,
    userId: string,
    status: "SUCCESS" | "PARTIAL" | "ERROR",
    workflowsCount: number,
    errorMessage: string | null
  ) {
    await prisma.syncLog.create({
      data: { connectionId, userId, status, workflowsCount, errorMessage },
    });
  }
}
