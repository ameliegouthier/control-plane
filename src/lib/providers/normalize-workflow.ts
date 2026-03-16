/**
 * Workflow normalization layer
 *
 * Converts provider-specific raw payloads into a single normalized graph format
 * (workflow.graph.nodes + workflow.graph.edges) so that enrichment, system map,
 * and UI can stay provider-agnostic.
 *
 * Pipeline:
 *   SECTION 0 · Provider raw JSON (n8n, Make, …)
 *   SECTION 1 · Workflow (normalized) ← this layer
 *   SECTION 2 · Raw workflow (enrichment input)
 *   SECTION 3 · Enrichment (domain, output, systems, health)
 */

import type { WorkflowGraphNode, WorkflowGraphEdge, WorkflowGraph, NodeCategory, AgentToolMeta } from "./types";
import { extractNotionDatabaseId } from "./notion-resources";

// ─── Service name normalization (provider-agnostic) ─────────────────────────────

/** Convert camelCase to kebab-case (e.g. "googleSheets" → "google-sheets"). */
function camelToKebab(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Normalize n8n node type to a stable service name for grouping.
 * Examples: "n8n-nodes-base.slack" → "slack", "n8n-nodes-base.googleSheets" → "google-sheets".
 */
export function n8nTypeToNormalizedService(type: string): string {
  const lastSegment = type.split(".").pop() ?? type;
  return camelToKebab(lastSegment);
}

/**
 * Normalize Make module string to service name (module is "service:action").
 * Example: "slack:CreateMessage" → "slack".
 */
export function makeModuleToService(moduleType: string): string {
  const service = moduleType.split(":")[0] ?? moduleType;
  return service.toLowerCase().trim();
}

// ─── Normalized node shape (all providers) ───────────────────────────────────────

/**
 * Normalized node structure produced by every provider adapter.
 * id, service, action, category are always set for n8n; Make fills what it can.
 */
export interface NormalizedNode {
  id: string;
  label: string;
  service: string;
  action: string;
  /** Canonical operation name (same as action for n8n; from module for Make). */
  operation?: string;
  /** Category: trigger, read, write, notify, ai, transform. */
  category: NodeCategory;
  /** Provider that produced this node. */
  provider: "n8n" | "make";
  kind: "trigger" | "action" | "router";
  type: string;
  /** Notion database ID when type contains "notion". */
  databaseId?: string;
  /** Slack channel when type contains "slack". */
  channelId?: string;
  /** Present when this node was extracted from an AI agent's tool flow. */
  meta?: AgentToolMeta;
}

/**
 * Build a WorkflowGraph from normalized nodes and edges.
 * Used by adapters after they produce normalized nodes.
 */
export function buildGraph(
  nodes: NormalizedNode[],
  edges: WorkflowGraphEdge[]
): WorkflowGraph {
  const graphNodes: WorkflowGraphNode[] = nodes.map((n) => ({
    id: n.id,
    label: n.label,
    kind: n.kind,
    type: n.type,
    provider: n.provider,
    service: n.service,
    operation: n.operation ?? n.action,
    category: n.category,
    ...(n.action != null && { action: n.action }),
    ...(n.databaseId != null && { databaseId: n.databaseId }),
    ...(n.channelId != null && { channelId: n.channelId }),
    ...(n.meta != null && { meta: n.meta }),
  }));
  return { nodes: graphNodes, edges };
}

// ─── n8n action inference and category ────────────────────────────────────────

/** Default action when parameters.operation and parameters.resource are missing (keyed by type segment, lowercase). */
const DEFAULT_ACTION_BY_SERVICE: Record<string, string> = {
  webhook: "trigger",
  slack: "postMessage",
  notion: "createPage",
  airtable: "write",
  googlesheets: "write",
  googledrive: "write",
  discord: "sendMessage",
  gmail: "sendEmail",
  gemini: "generate",
  openai: "generate",
};

function inferActionFromService(typeSegment: string): string {
  const key = typeSegment.toLowerCase().replace(/\s/g, "");
  return DEFAULT_ACTION_BY_SERVICE[key] ?? "execute";
}

/** Derive category from normalized service, action, and kind. */
function getCategoryForN8nNode(
  service: string,
  action: string,
  kind: "trigger" | "action" | "router"
): NodeCategory {
  const s = service.toLowerCase();
  const a = action.toLowerCase();

  if (kind === "trigger" || a === "trigger" || s === "webhook") return "trigger";
  if (s.includes("gemini") || s.includes("openai") || s.includes("ai")) return "ai";
  if (s.includes("slack") || s.includes("discord") || s.includes("gmail") || s.includes("email")) return "notify";
  if (a.includes("read") || a.includes("get") || a.includes("list") || a.includes("fetch")) return "read";
  if (
    s.includes("notion") ||
    s.includes("airtable") ||
    s.includes("google-sheets") ||
    s.includes("googlesheets") ||
    s.includes("google-drive") ||
    s.includes("googledrive")
  ) {
    return "write";
  }
  if (s.includes("if") || s.includes("switch") || s.includes("code") || s.includes("set")) return "transform";
  return "write";
}

// ─── n8n normalization helpers ────────────────────────────────────────────────

/**
 * n8n nodes come from raw.nodes[i].
 * - type: e.g. "n8n-nodes-base.googleSheets".
 * - parameters.operation / parameters.resource may be missing in imported workflows.
 *
 * STEP 1 — Service: type.split(".").pop() then normalize to kebab (e.g. googleSheets → google-sheets).
 * STEP 2 — Action: 1) parameters.operation 2) parameters.resource 3) infer from service (with ACTION_INFERRED log).
 * STEP 3 — Category: trigger | read | write | notify | ai | transform.
 */
export function normalizeN8nNode(
  rawNode: { id?: string; name?: string; type: string; parameters?: Record<string, unknown>; [key: string]: unknown },
  index: number,
  workflowExternalId: string
): NormalizedNode {
  const rawId = rawNode.id ?? `node_${index}`;
  const id = `${workflowExternalId}_${String(rawId)}`;
  const type = rawNode.type ?? "unknown";
  const typeLower = type.toLowerCase();
  const params = rawNode.parameters ?? {};

  const provider = "n8n" as const;

  // STEP 1 — Extract service from node type (last segment, then normalize)
  const typeSegment = type.split(".").pop() ?? type;
  const service = n8nTypeToNormalizedService(type);

  // STEP 2 — Action: explicit operation → resource → infer from service
  const explicitOperation =
    typeof params.operation === "string" && params.operation.trim() ? params.operation.trim() : null;
  const explicitResource =
    typeof params.resource === "string" && params.resource.trim() ? params.resource.trim() : null;
  let action: string;
  if (explicitOperation) {
    action = explicitOperation;
  } else if (explicitResource) {
    action = explicitResource;
  } else {
    action = inferActionFromService(typeSegment);
    if (process.env.NODE_ENV === "development") {
      console.log("ACTION_INFERRED", { service, nodeType: type });
    }
  }

  // Fallback: Slack nodes without operation/resource must still show in System Map
  if (service === "slack" && (!action || !action.trim())) {
    action = "postMessage";
  }

  const operation = action;
  let kind: "trigger" | "action" | "router" = "action";
  if (typeLower.includes("trigger") || typeLower.includes("webhook") || typeLower.includes("watch") || typeLower.includes("listener") || typeLower.includes("newsubmission")) {
    kind = "trigger";
  } else if (typeLower.includes("if") || typeLower.includes("switch")) {
    kind = "router";
  }

  // STEP 3 — Category
  const category = getCategoryForN8nNode(service, action, kind);

  const label = typeof rawNode.name === "string" && rawNode.name.trim() ? rawNode.name : service;

  const node: NormalizedNode = {
    id,
    label,
    provider,
    service,
    action,
    operation,
    category,
    kind,
    type,
  };

  if (typeLower.includes("notion")) {
    const databaseId = extractNotionDatabaseId(rawNode);
    if (databaseId) node.databaseId = databaseId;
  }
  if (typeLower.includes("slack")) {
    const channel = params.channel;
    if (typeof channel === "string" && channel) node.channelId = channel;
  }

  return node;
}

/**
 * Build edges from n8n connections (node names → we map to normalized node ids).
 */
export function buildN8nEdges(
  connections: Record<string, { main?: Array<Array<{ node: string; type: string; index: number }>> }> | undefined,
  nameToId: Map<string, string>
): WorkflowGraphEdge[] {
  const edges: WorkflowGraphEdge[] = [];
  if (!connections) return edges;

  for (const [sourceNodeName, conn] of Object.entries(connections)) {
    const sourceId = nameToId.get(sourceNodeName);
    if (!sourceId) continue;
    const mainConnections = conn.main ?? [];
    for (const slot of mainConnections) {
      for (const edge of slot) {
        const targetId = nameToId.get(edge.node);
        if (targetId) edges.push({ from: sourceId, to: targetId });
      }
    }
  }
  return edges;
}

// ─── Make normalization helpers ───────────────────────────────────────────────

/** Derive category for Make nodes from kind and operation. */
function getCategoryForMakeNode(kind: "trigger" | "action" | "router", operation: string): NodeCategory {
  if (kind === "trigger") return "trigger";
  const op = operation.toLowerCase();
  if (op.includes("read") || op.includes("get") || op.includes("list")) return "read";
  if (op.includes("send") || op.includes("post") || op.includes("message") || op.includes("email")) return "notify";
  if (op.includes("generate") || op.includes("complete")) return "ai";
  return "write";
}

/**
 * Make nodes come from raw.flow[i]. Each item has:
 * - module: string like "airtable:createRecord" (service:action).
 * - metadata.designer.name: optional human label in the designer.
 *
 * Service = module.split(":")[0], operation = module.split(":")[1].
 * Category derived from kind and operation.
 */
export function normalizeMakeFlowItem(
  item: { id?: string | number; module?: string; metadata?: { designer?: { name?: string }; [key: string]: unknown }; [key: string]: unknown },
  index: number
): NormalizedNode {
  const rawId = item.id ?? `node_${index}`;
  const id = String(rawId);
  const moduleType = typeof item.module === "string" ? item.module : "unknown";

  const provider = "make" as const;
  const service = makeModuleToService(moduleType);
  const operation = moduleType.includes(":") ? (moduleType.split(":")[1] ?? "execute") : "execute";
  const action = operation;

  const metaName = typeof item.metadata?.designer?.name === "string" ? item.metadata.designer.name.trim() : "";
  const label = metaName.length > 0 ? metaName : moduleType;

  const kind: "trigger" | "action" | "router" = index === 0 ? "trigger" : "action";
  const category = getCategoryForMakeNode(kind, action);

  return {
    id,
    label,
    provider,
    service,
    action,
    operation,
    category,
    kind,
    type: moduleType,
  };
}

/**
 * Build linear edges between main flow nodes (flow[i] → flow[i+1]).
 * Reuse when no explicit connection map is available (Make flow array order).
 */
export function buildMakeLinearEdges(nodeIds: string[]): WorkflowGraphEdge[] {
  const edges: WorkflowGraphEdge[] = [];
  for (let i = 0; i < nodeIds.length - 1; i++) {
    edges.push({ from: nodeIds[i], to: nodeIds[i + 1] });
  }
  return edges;
}
