/**
 * Make Provider Adapter
 *
 * Handles fetching, normalizing, and syncing workflows from Make.com instances.
 * Currently implements normalization stub ready for future API integration.
 */

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

// ─── Make-specific types ──────────────────────────────────────────────────────

interface MakeNode {
  id?: string;
  name?: string;
  type: string;
  parameters?: Record<string, unknown>;
  position?: [number, number];
  [key: string]: unknown;
}

interface MakeWorkflow {
  id: string | number;
  name: string;
  enabled?: boolean;
  active?: boolean;
  modules?: MakeNode[];
  connections?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ─── Make Adapter Implementation ───────────────────────────────────────────────

export class MakeAdapter implements ProviderAdapter {
  readonly provider = "make" as const;

  /**
   * Fetch workflows from Make API.
   * TODO: Implement when Make API integration is ready.
   */
  async fetchWorkflows(
    connection: ProviderConnection
  ): Promise<FetchWorkflowsResult> {
    // Stub implementation - will be replaced with actual Make API call
    return {
      success: false,
      workflows: [],
      error: "Make adapter not yet implemented",
    };
  }

  /**
   * Normalize a Make workflow into the generic Workflow model.
   * Maps Make-specific structure to provider-agnostic Workflow format.
   */
  normalizeWorkflow(
    raw: RawProviderWorkflow,
    connectionId: string
  ): Workflow | null {
    const makeWorkflow = raw as MakeWorkflow;

    if (!makeWorkflow.id || !makeWorkflow.name) {
      return null;
    }

    // Make uses "modules" instead of "nodes", and "enabled" instead of "active"
    const rawModules = makeWorkflow.modules ?? [];
    const graphNodes: WorkflowGraphNode[] = rawModules.map((m, index) => {
      const moduleId = m.id ?? `module_${index}`;
      const moduleName = m.name ?? `Module ${index}`;
      const moduleType = m.type ?? "unknown";
      const typeLower = moduleType.toLowerCase();
      
      // Determine node kind based on type
      let kind: "trigger" | "action" | "router" | "other" = "other";
      if (typeLower.includes("trigger") || typeLower.includes("webhook")) {
        kind = "trigger";
      } else if (typeLower.includes("router") || typeLower.includes("filter")) {
        kind = "router";
      } else if (!typeLower.includes("trigger")) {
        kind = "action";
      }

      return {
        id: moduleId,
        label: moduleName,
        kind,
        type: moduleType,
      };
    });

    // Normalize connections to WorkflowGraph edges
    // Create mapping from node name to node ID
    const nameToId = new Map<string, string>();
    for (const node of graphNodes) {
      // Find the original module by matching label to name
      const originalModule = rawModules.find((m) => (m.name ?? "") === node.label);
      if (originalModule) {
        const originalName = originalModule.name ?? "";
        nameToId.set(originalName, node.id);
      }
    }

    const edges: WorkflowGraphEdge[] = [];
    const connections = makeWorkflow.connections as Record<string, {
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

    // Make uses "enabled" field, normalize to "active"
    const active = makeWorkflow.active ?? makeWorkflow.enabled ?? false;

    return {
      id: String(makeWorkflow.id),
      name: makeWorkflow.name,
      active,
      provider: "make",
      connectionId,
      graph,
      updatedAt: makeWorkflow.updatedAt ?? new Date().toISOString(),
      createdAt: makeWorkflow.createdAt ?? new Date().toISOString(),
    };
  }

  /**
   * Sync workflows from Make to the database.
   * TODO: Implement when Make API integration is ready.
   */
  async syncWorkflows(
    connection: ProviderConnection
  ): Promise<SyncWorkflowsResult> {
    // Stub implementation - will be replaced with actual sync logic
    return {
      success: false,
      synced: 0,
      error: "Make adapter not yet implemented",
    };
  }
}
