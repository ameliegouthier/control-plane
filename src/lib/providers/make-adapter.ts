/**
 * Make Provider Adapter
 *
 * Handles fetching, normalizing, and syncing workflows from Make.com instances.
 * Uses Make API v2: organizations → organizationId → scenarios.
 */

import fs from "fs/promises";
import path from "path";

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { makeApiFetch } from "./make-client";
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
import { syncWorkflowNodes } from "./sync-workflow-nodes";
import type { AgentToolMeta } from "./types";
import {
  normalizeMakeFlowItem,
  makeModuleToService,
  buildMakeLinearEdges,
  buildGraph,
  type NormalizedNode,
} from "./normalize-workflow";

// Make API v2 base URL (EU2). Config can override via baseUrl.
const MAKE_API_BASE_DEFAULT = "https://eu2.make.com/api/v2";

// ─── Make-specific types ──────────────────────────────────────────────────────

interface MakeNode {
  id?: string;
  name?: string;
  type: string;
  parameters?: Record<string, unknown>;
  position?: [number, number];
  [key: string]: unknown;
}

interface MakeFlowItem {
  id?: string | number;
  module?: string;
  version?: string;
  metadata?: {
    designer?: {
      name?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  /**
   * Some Make modules expose nested "tools" which each contain their own flow of modules.
   * These nested flow items should also be treated as graph nodes.
   */
  tools?: Array<{
    name?: string;
    flow?: MakeFlowItem[];
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

interface MakeWorkflow {
  id: string | number;
  name: string;
  enabled?: boolean;
  active?: boolean;
  modules?: MakeNode[];
  connections?: Record<string, unknown>;
  /** New Make structure: linear flow of modules, each item is a node. */
  flow?: MakeFlowItem[];
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

  private isMockMode(): boolean {
    const flag = process.env.MOCK_MAKE;
    if (!flag) return false;
    const normalized = flag.toString().trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }

  /**
   * Resolve Make API base URL from connection config.
   * The integration baseUrl must be the Make API base only (e.g. https://eu2.make.com/api/v2).
   * Endpoints such as /organizations and /scenarios are appended internally by the adapter.
   */
  private getBaseUrl(connection: ProviderConnection): string {
    const config = connection.config as Record<string, string | undefined>;
    const base = config?.baseUrl?.trim();
    if (!base) return MAKE_API_BASE_DEFAULT;

    // Normalize:
    // - strip trailing slashes
    // - prevent users from accidentally appending endpoint segments like "/scenarios"
    let normalized = base.replace(/\/+$/, "");
    if (normalized.endsWith("/scenarios")) {
      normalized = normalized.replace(/\/scenarios$/, "");
    }
    return normalized;
  }

  /**
   * Resolve API token from connection config (apiToken, apiKey, or token).
   */
  private getApiToken(connection: ProviderConnection): string | null {
    const config = connection.config as Record<string, string | undefined>;
    const token = config?.apiToken ?? config?.apiKey ?? config?.token;
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

    const url = path.startsWith("http")
      ? path
      : `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\//, "")}`;

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

    const organizationId = String(org.id);
    return organizationId;
  }

  /**
   * Fetch workflows (scenarios) from Make API.
   * Flow: get organization id → GET /scenarios?organizationId=XXX.
   */
  async fetchWorkflows(
    connection: ProviderConnection
  ): Promise<FetchWorkflowsResult> {
    if (this.isMockMode()) {
      try {
        const mockWorkflows = await this.fetchMockWorkflows();
        return mockWorkflows;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown error loading mock Make workflows";
        return {
          success: false,
          workflows: [],
          error: message,
        };
      }
    }

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
      const scenariosPath = `/scenarios?organizationId=${organizationId}`;
      const res = await this.makeRequest<MakeScenariosResponse>(connection, scenariosPath);
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
   * Load Make workflows from local blueprint JSON files in mock mode.
   * This bypasses the real Make API and lets us simulate scenarios until OAuth is available.
   */
  private async fetchMockWorkflows(): Promise<FetchWorkflowsResult> {
    const mockDir = path.join(process.cwd(), "src", "lib", "mock", "make");

    let entries: string[];
    try {
      entries = await fs.readdir(mockDir);
    } catch (err) {
      const message =
        err instanceof Error
          ? `Failed to read mock Make directory at ${mockDir}: ${err.message}`
          : `Failed to read mock Make directory at ${mockDir}`;
      throw new Error(message);
    }

    const jsonFiles = entries.filter((file) => file.toLowerCase().endsWith(".json"));
    const workflows: MakeWorkflow[] = [];

    for (const file of jsonFiles) {
      const fullPath = path.join(mockDir, file);
      try {
        const raw = await fs.readFile(fullPath, "utf8");
        const parsed = JSON.parse(raw) as Partial<MakeWorkflow> & Record<string, unknown>;

        const fileId = path.basename(file, path.extname(file));
        const id = parsed.id ?? fileId;
        const name = parsed.name ?? String(id);

        const flow = Array.isArray(parsed.flow) ? parsed.flow : [];
        const modules = Array.isArray(parsed.modules) ? parsed.modules : undefined;
        const connections =
          parsed.connections && typeof parsed.connections === "object"
            ? (parsed.connections as Record<string, unknown>)
            : undefined;

        const workflow: MakeWorkflow = {
          id,
          name,
          enabled: (parsed as any).enabled,
          active: (parsed as any).active,
          modules,
          connections,
          flow,
          createdAt: (parsed as any).createdAt as string | undefined,
          updatedAt: (parsed as any).updatedAt as string | undefined,
        };

        workflows.push(workflow);
      } catch {
        // Skip invalid mock blueprint file
      }
    }

    return {
      success: true,
      workflows: workflows as RawProviderWorkflow[],
    };
  }

  /**
   * Recursively extract all flow items from a Make workflow, including
   * modules nested inside agent tools (tools[].flow).
   *
   * Each returned entry pairs a flow item with optional agent-tool metadata
   * so that the caller can tag normalized nodes without altering ids or edges.
   */
  private extractModules(
    flow: MakeFlowItem[] | undefined,
  ): Array<{ item: MakeFlowItem; agentToolMeta?: AgentToolMeta }> {
    if (!Array.isArray(flow) || flow.length === 0) return [];

    const result: Array<{ item: MakeFlowItem; agentToolMeta?: AgentToolMeta }> = [];

    const visit = (
      items: MakeFlowItem[],
      agentToolMeta?: AgentToolMeta,
    ) => {
      for (const step of items) {
        result.push({ item: step, agentToolMeta });

        if (Array.isArray(step.tools)) {
          const parentAgentId = String(step.id ?? "");
          for (const tool of step.tools) {
            if (Array.isArray(tool.flow) && tool.flow.length > 0) {
              const toolMeta: AgentToolMeta = {
                isAgentTool: true,
                parentAgentId,
                toolName: tool.name ?? "Unknown Tool",
              };
              visit(tool.flow, toolMeta);
            }
          }
        }
      }
    };

    visit(flow);
    return result;
  }

  /**
   * Normalize a Make workflow into the generic Workflow model.
   * Uses the shared normalization layer so Make and n8n produce the same
   * normalized node shape (id, label, service, action?, kind, type).
   * Make flow items use module "service:action"; first step is trigger, rest action.
   * Legacy path (modules + connections) is supported when flow is absent.
   */
  normalizeWorkflow(
    raw: RawProviderWorkflow,
    connectionId: string
  ): Workflow | null {
    const makeWorkflow = raw as MakeWorkflow;

    if (!makeWorkflow.id || !makeWorkflow.name) {
      return null;
    }

    // Flatten flow + any nested tool flows so that actions executed inside
    // agent tools (ai-local-agent, etc.) are also represented as graph nodes.
    const extracted = this.extractModules(makeWorkflow.flow);
    let graph: WorkflowGraph;

    if (extracted.length > 0) {
      const normalizedNodes: NormalizedNode[] = extracted.map(({ item, agentToolMeta }, index) => {
        const node = normalizeMakeFlowItem(item, index);
        if (agentToolMeta) {
          node.meta = agentToolMeta;
        }
        return node;
      });
      const edges: WorkflowGraphEdge[] = [];
      for (let i = 0; i < normalizedNodes.length; i++) {
        const node = normalizedNodes[i];

        if (node.meta?.isAgentTool) {
          edges.push({
            from: node.meta.parentAgentId,
            to: node.id,
          });
          continue;
        }

        const next = normalizedNodes[i + 1];

        if (next && !next.meta?.isAgentTool) {
          edges.push({
            from: node.id,
            to: next.id,
          });
        }
      }

      console.log(
        "ADAPTER EDGES",
        edges.map((e) => `${e.from} → ${e.to}`)
      );

      graph = buildGraph(normalizedNodes, edges);
    } else {
      graph = this.normalizeMakeLegacyGraph(makeWorkflow);
    }

    const active = makeWorkflow.active ?? makeWorkflow.enabled ?? false;
    const providerWorkflowId = String(makeWorkflow.id);

    return {
      id: providerWorkflowId, // Sync uses this only to fill config.externalId; UI gets DB id from repository
      externalId: providerWorkflowId,
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
   * Legacy Make format: modules[] + connections. Produces the same normalized
   * node shape (provider, service, operation from type "service:action").
   */
  private normalizeMakeLegacyGraph(makeWorkflow: MakeWorkflow): WorkflowGraph {
    const rawModules = makeWorkflow.modules ?? [];
    const normalizedNodes: NormalizedNode[] = rawModules.map((m, index) => {
      const moduleType = m.type ?? "unknown";
      const provider = "make" as const;
      const service = makeModuleToService(moduleType);
      const operation = moduleType.includes(":") ? (moduleType.split(":")[1] ?? "execute") : "execute";
      const action = operation;
      const typeLower = moduleType.toLowerCase();
      const kind: "trigger" | "action" | "router" =
        index === 0 ? "trigger" : typeLower.includes("router") || typeLower.includes("filter") ? "router" : "action";
      const category: NormalizedNode["category"] = kind === "trigger" ? "trigger" : "write";
      return {
        id: String(m.id ?? `module_${index}`),
        label: m.name ?? moduleType,
        provider,
        service,
        action,
        operation,
        category,
        kind,
        type: moduleType,
      };
    });

    const nameToId = new Map<string, string>();
    for (const node of normalizedNodes) {
      nameToId.set(node.label, node.id);
    }

    const edges: WorkflowGraphEdge[] = [];
    const connections = makeWorkflow.connections as
      | Record<string, { main?: Array<Array<{ node: string; type: string; index: number }>> }>
      | undefined;
    if (connections) {
      for (const [sourceNodeName, conn] of Object.entries(connections)) {
        const sourceId = nameToId.get(sourceNodeName);
        if (!sourceId) continue;
        for (const slot of conn.main ?? []) {
          for (const edge of slot) {
            const targetId = nameToId.get(edge.node);
            if (targetId) edges.push({ from: sourceId, to: targetId });
          }
        }
      }
    }

    return buildGraph(normalizedNodes, edges);
  }

  /**
   * Sync workflows from Make to the database.
   * Fetches scenarios via API, normalizes, and upserts to DB.
   */
  async syncWorkflows(
    connection: ProviderConnection
  ): Promise<SyncWorkflowsResult> {
    const db = prisma as any;
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
          externalId: normalized.externalId ?? normalized.id,
          actions,
          triggerConfig,
          // Debug snapshot of original Make workflow / blueprint
          rawProviderWorkflow: rawWf,
        } as Prisma.InputJsonValue;

        const existing = await db.workflow.findFirst({
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
          await db.workflow.update({
            where: { id: existing.id },
            data: workflowData,
          });
          workflowId = existing.id;
        } else {
          const created = await db.workflow.create({
            data: {
              userId: connection.userId,
              integrationId,
              ...workflowData,
            },
          });
          workflowId = created.id;
        }

        await syncWorkflowNodes(workflowId, normalized.graph);
        synced++;
      }

      await db.integration.update({
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
    const db = prisma as any;
    await db.syncLog.create({
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

// ─── High-level helpers for OAuth-based Make usage ─────────────────────────────

export interface MakeScenarioSummary {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface NormalizedMakeScenarioBlueprintNode {
  module: string;
  service: string;
}

export interface NormalizedMakeScenarioBlueprint {
  provider: "make";
  externalId: string;
  name: string;
  nodes: NormalizedMakeScenarioBlueprintNode[];
  usedServices: string[];
  rawBlueprint: unknown;
}

/**
 * List Make scenarios for the current user using OAuth-based access.
 */
export async function listMakeScenarios(
  userId: string,
): Promise<MakeScenarioSummary[]> {
  type ScenariosResponse = { scenarios?: Array<{ id: string | number; name?: string } & Record<string, unknown>> };

  const res = await makeApiFetch<ScenariosResponse>(userId, "/scenarios");
  const scenarios = Array.isArray(res.scenarios) ? res.scenarios : [];

  return scenarios.map((s) => {
    const { id, name, ...rest } = s;
    return {
      id: String(id),
      name: name ?? `Scenario ${String(id)}`,
      ...rest,
    };
  });
}

/**
 * Fetch and normalize a single Make scenario blueprint into a compact structure
 * that surfaces module usage and services while still exposing the raw blueprint.
 */
export async function getMakeScenarioBlueprint(
  userId: string,
  scenarioId: string | number,
): Promise<NormalizedMakeScenarioBlueprint> {
  type BlueprintResponse = {
    id?: string | number;
    name?: string;
    flow?: Array<{ module?: string } & Record<string, unknown>>;
    [key: string]: unknown;
  };

  const blueprint = await makeApiFetch<BlueprintResponse>(
    userId,
    `/scenarios/${encodeURIComponent(String(scenarioId))}/blueprint`,
  );

  const externalId = String(blueprint.id ?? scenarioId);
  const name = blueprint.name ?? `Scenario ${externalId}`;
  const flow = Array.isArray(blueprint.flow) ? blueprint.flow : [];

  const nodes: NormalizedMakeScenarioBlueprintNode[] = flow
    .map((node) => {
      const module = typeof node.module === "string" ? node.module : "";
      if (!module) return null;
      const service = makeModuleToService(module);
      return {
        module,
        service,
      };
    })
    .filter((n): n is NormalizedMakeScenarioBlueprintNode => Boolean(n));

  const usedServices = Array.from(
    new Set(nodes.map((n) => n.service).filter(Boolean)),
  );

  return {
    provider: "make",
    externalId,
    name,
    nodes,
    usedServices,
    rawBlueprint: blueprint,
  };
}

/**
 * Convenience helper to fetch and normalize all Make workflows for a user.
 * Intended for the /api/integrations/make/sync endpoint – it does not mutate
 * the database and only returns structured JSON.
 */
export async function syncMakeWorkflows(userId: string): Promise<{
  workflows: NormalizedMakeScenarioBlueprint[];
}> {
  const scenarios = await listMakeScenarios(userId);

  const workflows: NormalizedMakeScenarioBlueprint[] = [];
  for (const scenario of scenarios) {
    try {
      const normalized = await getMakeScenarioBlueprint(userId, scenario.id);
      workflows.push(normalized);
    } catch {
      // Skip scenario if blueprint fetch fails
    }
  }

  return { workflows };
}

