/**
 * Make Provider Adapter
 *
 * Handles fetching, normalizing, and syncing workflows from Make.com instances.
 * Uses Make API v2: organizations → organizationId → scenarios.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
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

// Make API v2 base URL (EU1). Config can override via baseUrl.
const MAKE_API_BASE_DEFAULT = "https://eu1.make.com/api/v2";

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

interface MakeOrganizationsResponse {
  organizations?: Array<{ id: number; name?: string; [key: string]: unknown }>;
}

interface MakeScenariosResponse {
  scenarios?: MakeWorkflow[];
}

// ─── Make Adapter Implementation ───────────────────────────────────────────────

export class MakeAdapter implements ProviderAdapter {
  readonly provider = "make" as const;

  /**
   * Resolve Make API base URL from connection config.
   * The integration baseUrl must be the Make API base only (e.g. https://eu1.make.com/api/v2).
   * Endpoints such as /organizations and /scenarios are appended internally by the adapter.
   */
  private getBaseUrl(connection: ProviderConnection): string {
    const config = connection.config as Record<string, string | undefined>;
    const base = config?.baseUrl?.trim();
    if (!base) return MAKE_API_BASE_DEFAULT;
    return base.replace(/\/+$/, "");
  }

  /**
   * Resolve API token from connection config (apiToken or apiKey).
   */
  private getApiToken(connection: ProviderConnection): string | null {
    const config = connection.config as Record<string, string | undefined>;
    const token = config?.apiToken ?? config?.apiKey;
    return typeof token === "string" && token.trim() ? token.trim() : null;
  }

  /**
   * Low-level GET request to Make API with Authorization: Token {apiToken}.
   * path is an endpoint relative to the API base (e.g. "organizations", "scenarios?organizationId=123");
   * the adapter appends it to baseUrl and never expects the user to provide full URLs or endpoints.
   */
  private async makeRequest<T = unknown>(
    connection: ProviderConnection,
    path: string
  ): Promise<T> {
    const baseUrl = this.getBaseUrl(connection);
    const token = this.getApiToken(connection);
    if (!token) {
      throw new Error("Make API token is required. Set apiToken or apiKey in connection config.");
    }

    const url = path.startsWith("http") ? path : `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\//, "")}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Token ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        text ? `Make API responded with ${res.status}: ${text}` : `Make API responded with ${res.status}`
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      throw new Error(`Make API responded with non-JSON (${contentType || "unknown"})`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * Retrieve the first organization id for the authenticated user.
   * Required by Make API before fetching scenarios.
   */
  private async getOrganizationId(connection: ProviderConnection): Promise<string> {
    const res = await this.makeRequest<MakeOrganizationsResponse>(connection, "/organizations");
    const org = res?.organizations?.[0];

    if (!org?.id) {
      throw new Error(
        "No Make organization found. Check API token permissions."
      );
    }

    return String(org.id);
  }

  /**
   * Fetch workflows (scenarios) from Make API.
   * Flow: get organization id → GET /scenarios?organizationId=XXX.
   */
  async fetchWorkflows(
    connection: ProviderConnection
  ): Promise<FetchWorkflowsResult> {
    const token = this.getApiToken(connection);
    if (!token) {
      return {
        success: false,
        workflows: [],
        error: "Make API token is required. Set apiToken or apiKey in connection config.",
      };
    }

    try {
      const organizationId = await this.getOrganizationId(connection);
      const res = await this.makeRequest<MakeScenariosResponse>(
        connection,
        `/scenarios?organizationId=${organizationId}`
      );
      const scenarios = res?.scenarios ?? [];

      return {
        success: true,
        workflows: scenarios as RawProviderWorkflow[],
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error calling Make API";
      return {
        success: false,
        workflows: [],
        error: message,
      };
    }
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
   * Fetches scenarios via API, normalizes, and upserts to DB.
   */
  async syncWorkflows(
    connection: ProviderConnection
  ): Promise<SyncWorkflowsResult> {
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

    const rawWorkflows = fetchResult.workflows as MakeWorkflow[];
    let synced = 0;

    try {
      for (const rawWf of rawWorkflows) {
        const normalized = this.normalizeWorkflow(rawWf, connection.id);
        if (!normalized) continue;

        const triggerNode = normalized.graph?.nodes.find((n) => {
          const t = n.type.toLowerCase();
          return t.includes("trigger") || t.includes("webhook");
        });

        const triggerConfig = triggerNode
          ? ({} as Prisma.InputJsonValue)
          : Prisma.JsonNull;

        const legacyNodes =
          normalized.graph?.nodes.map((n) => ({
            id: n.id,
            name: n.label,
            type: n.type,
            position: [0, 0] as [number, number],
          })) ?? [];

        const legacyConnections: Record<
          string,
          { main: Array<Array<{ node: string; type: string; index: number }>> }
        > = {};
        if (normalized.graph) {
          for (const edge of normalized.graph.edges) {
            if (!legacyConnections[edge.from]) {
              legacyConnections[edge.from] = { main: [] };
            }
            legacyConnections[edge.from].main.push([
              { node: edge.to, type: "main", index: 0 },
            ]);
          }
        }

        const actions = {
          nodes: legacyNodes,
          connections: legacyConnections,
          graph: normalized.graph,
        };

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

      return { success: true, synced };
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

  private async logSync(
    integrationId: string,
    userId: string,
    status: "SUCCESS" | "PARTIAL" | "ERROR",
    workflowsCount: number,
    errorMessage: string | null
  ): Promise<void> {
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
