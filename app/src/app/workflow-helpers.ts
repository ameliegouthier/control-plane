import type { Workflow as DbWorkflow, ToolType } from "@prisma/client";
import type {
  Workflow,
  WorkflowGraph,
  WorkflowGraphNode,
  WorkflowGraphEdge,
  AutomationProvider,
} from "@/lib/providers/types";

// ─── Re-export provider-agnostic types ────────────────────────────────────────

export type { Workflow, AutomationProvider };

// ─── Provider Mapping ──────────────────────────────────────────────────────────

/**
 * Map Prisma ToolType enum to AutomationProvider string.
 */
function mapToolTypeToProvider(tool: ToolType | null | undefined): AutomationProvider {
  switch (tool) {
    case "N8N":
      return "n8n";
    case "MAKE":
      return "make";
    case "ZAPIER":
      return "zapier";
    default:
      return "n8n"; // Default for backward compatibility
  }
}

// ─── Prisma → Workflow mapper ────────────────────────────────────────────────

/**
 * Safely convert a Prisma Workflow row (with Json `actions` field) into the
 * strict frontend `Workflow` type with WorkflowGraph.
 * Validates every node through a type guard and falls back to empty values for missing/corrupt data.
 */
export function toWorkflow(db: DbWorkflow): Workflow {
  // `actions` is Prisma Json? — might be null, a primitive, an array, etc.
  const actions =
    db.actions != null &&
    typeof db.actions === "object" &&
    !Array.isArray(db.actions)
      ? (db.actions as Record<string, unknown>)
      : {};

  // Use provider field directly if available, otherwise derive from connection (backward compatibility)
  const provider: AutomationProvider = 
    (db as { provider?: string }).provider && 
    ["n8n", "make", "zapier", "airtable"].includes((db as { provider?: string }).provider!)
      ? (db as { provider: AutomationProvider }).provider
      : mapToolTypeToProvider(db.connection?.tool);

  // Try to use graph if available (new format), otherwise convert from legacy format
  let graph: WorkflowGraph | undefined;
  
  if (actions.graph && typeof actions.graph === "object") {
    // New format: graph already exists
    const g = actions.graph as { nodes?: unknown[]; edges?: unknown[] };
    const nodes = Array.isArray(g.nodes) 
      ? g.nodes.map(parseGraphNode).filter(Boolean) as WorkflowGraphNode[]
      : [];
    const edges = Array.isArray(g.edges)
      ? g.edges.map(parseGraphEdge).filter(Boolean) as WorkflowGraphEdge[]
      : [];
    graph = { nodes, edges };
  } else {
    // Legacy format: convert from nodes/connections
    const rawNodes = actions.nodes;
    const legacyNodes = Array.isArray(rawNodes)
      ? rawNodes.map(parseLegacyNode).filter(Boolean)
      : [];

    const rawConns = actions.connections;
    const legacyConnections =
      rawConns != null &&
      typeof rawConns === "object" &&
      !Array.isArray(rawConns)
        ? (rawConns as Record<string, {
            main?: Array<Array<{ node: string; type: string; index: number }>>;
          }>)
        : {};

    // Convert legacy format to WorkflowGraph
    const graphNodes: WorkflowGraphNode[] = legacyNodes.map((n) => {
      const typeLower = n.type.toLowerCase();
      let kind: "trigger" | "action" | "router" | "other" = "other";
      if (typeLower.includes("trigger") || typeLower.includes("webhook")) {
        kind = "trigger";
      } else if (typeLower.includes("if") || typeLower.includes("switch") || typeLower.includes("router")) {
        kind = "router";
      } else if (!typeLower.includes("trigger")) {
        kind = "action";
      }

      return {
        id: n.id,
        label: n.name,
        kind,
        type: n.type,
      };
    });

    const graphEdges: WorkflowGraphEdge[] = [];
    for (const [sourceNodeName, conn] of Object.entries(legacyConnections)) {
      const mainConnections = conn.main ?? [];
      for (const slot of mainConnections) {
        for (const edge of slot) {
          graphEdges.push({
            from: sourceNodeName,
            to: edge.node,
          });
        }
      }
    }

    graph = { nodes: graphNodes, edges: graphEdges };
  }

  // Use externalId if available, otherwise fall back to toolWorkflowId (backward compatibility)
  const workflowId = (db as { externalId?: string }).externalId ?? db.toolWorkflowId;

  return {
    id: workflowId,
    name: db.name,
    active: db.status === "active",
    provider,
    connectionId: db.connectionId,
    graph,
    updatedAt: db.updatedAt.toISOString(),
    createdAt: db.createdAt.toISOString(),
  };
}

/**
 * Parse a WorkflowGraphNode from raw data.
 */
function parseGraphNode(val: unknown): WorkflowGraphNode | null {
  if (val == null || typeof val !== "object") return null;
  const obj = val as Record<string, unknown>;
  if (typeof obj.id !== "string" || typeof obj.label !== "string" || typeof obj.type !== "string") {
    return null;
  }
  return {
    id: obj.id,
    label: obj.label,
    kind: (obj.kind as "trigger" | "action" | "router" | "other") ?? "other",
    type: obj.type,
  };
}

/**
 * Parse a WorkflowGraphEdge from raw data.
 */
function parseGraphEdge(val: unknown): WorkflowGraphEdge | null {
  if (val == null || typeof val !== "object") return null;
  const obj = val as Record<string, unknown>;
  if (typeof obj.from !== "string" || typeof obj.to !== "string") {
    return null;
  }
  return { from: obj.from, to: obj.to };
}

/**
 * Parse a legacy node format (for backward compatibility).
 */
function parseLegacyNode(val: unknown): { id: string; name: string; type: string } | null {
  if (val == null || typeof val !== "object") return null;
  const obj = val as Record<string, unknown>;
  if (typeof obj.name !== "string" || typeof obj.type !== "string") return null;
  return {
    id: typeof obj.id === "string" ? obj.id : obj.name,
    name: obj.name,
    type: obj.type,
  };
}

export interface MiniMapNode {
  name: string;
  type: string;
  label: string;
}

export interface MiniMap {
  mainPath: MiniMapNode[];
  branches: MiniMapNode[][];
}

export interface TriggerSummary {
  /** Short human label, e.g. "Webhook · /healthcheck" */
  label: string;
  kind: "webhook" | "schedule" | "manual" | "other";
  /** Key config fields extracted from trigger parameters */
  config: Record<string, string>;
}

export interface ActionPills {
  /** Up to 4 human-readable action labels */
  pills: string[];
  /** How many actions beyond the displayed pills */
  remaining: number;
}

export interface Signals {
  hasBranching: boolean;
  hasExternalCalls: boolean;
}

// ─── Core helpers ────────────────────────────────────────────────────────────

/** Find the trigger node from WorkflowGraph (first node with kind "trigger") */
export function getTriggerNode(graph: WorkflowGraph | undefined): WorkflowGraphNode | null {
  if (!graph) return null;
  return graph.nodes.find((n) => n.kind === "trigger") ?? null;
}

/** Simple trigger kind label (kept for backward compat in mini-map) */
export function getTriggerLabel(graph: WorkflowGraph | undefined): string {
  return getTriggerSummary(graph).label;
}

/**
 * Turn provider-specific node types into human-readable labels.
 * Examples:
 *   - "n8n-nodes-base.httpRequest" → "HTTP Request"
 *   - "make.httpRequest" → "HTTP Request"
 *   - "zapier.webhook" → "Webhook"
 * Strips vendor prefix, splits camelCase, title-cases.
 */
export function formatNodeType(type: string): string {
  // Remove provider prefixes (n8n-nodes-base., make., zapier., etc.)
  const raw = type.includes(".") ? type.split(".").pop()! : type;
  const words = raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return words
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── A) Trigger Summary ─────────────────────────────────────────────────────

export function getTriggerSummary(graph: WorkflowGraph | undefined): TriggerSummary {
  const trigger = getTriggerNode(graph);
  if (!trigger) return { label: "Manual", kind: "manual", config: {} };

  const t = trigger.type.toLowerCase();

  // Webhook
  if (t.includes("webhook")) {
    // Extract path from type or use default
    const label = formatNodeType(trigger.type);
    return { label, kind: "webhook", config: {} };
  }

  // Schedule
  if (t.includes("schedule") || t.includes("cron")) {
    const label = formatNodeType(trigger.type);
    return { label, kind: "schedule", config: {} };
  }

  // Manual
  if (t.includes("manual")) {
    return { label: "Manual", kind: "manual", config: {} };
  }

  return { label: formatNodeType(trigger.type), kind: "other", config: {} };
}


// ─── B) Action Summary ──────────────────────────────────────────────────────

const PILL_MAP: Record<string, string> = {
  httpRequest: "HTTP Request",
  set: "Set Fields",
  code: "Code",
  if: "If",
  switch: "Switch",
  merge: "Merge",
  splitInBatches: "Batch",
  respondToWebhook: "Respond",
  function: "Function",
  functionItem: "Function Item",
  noOp: "No-Op",
  wait: "Wait",
  executeWorkflow: "Sub-Workflow",
};

/**
 * Return ordered action pills (up to `max`) + remaining count.
 * Nodes are ordered via edge walk when possible.
 */
export function getActionPills(
  graph: WorkflowGraph | undefined,
  max = 4
): ActionPills {
  if (!graph) return { pills: [], remaining: 0 };
  
  const trigger = getTriggerNode(graph);
  const ordered = getOrderedNonTriggerNodes(graph, trigger);
  const labels = ordered.map((n) => pillLabel(n.type));
  const pills = labels.slice(0, max);
  const remaining = Math.max(0, labels.length - max);
  return { pills, remaining };
}

/** Map a node type to a short pill label */
function pillLabel(type: string): string {
  const raw = type.includes(".") ? type.split(".").pop()! : type;
  return PILL_MAP[raw] ?? formatNodeType(type);
}

/** Walk edges from trigger to produce non-trigger nodes in logical order */
function getOrderedNonTriggerNodes(
  graph: WorkflowGraph,
  trigger: WorkflowGraphNode | null
): WorkflowGraphNode[] {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const nodeByLabel = new Map(graph.nodes.map((n) => [n.label, n]));
  const edgesByFrom = new Map<string, WorkflowGraphEdge[]>();
  
  // Build edge index
  for (const edge of graph.edges) {
    if (!edgesByFrom.has(edge.from)) {
      edgesByFrom.set(edge.from, []);
    }
    edgesByFrom.get(edge.from)!.push(edge);
  }

  const triggerId = trigger?.id;
  const visited = new Set<string>();
  const result: WorkflowGraphNode[] = [];

  function walk(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodeById.get(nodeId);
    if (node && node.id !== triggerId && node.kind !== "trigger") {
      result.push(node);
    }
    const edges = edgesByFrom.get(nodeId) ?? [];
    for (const edge of edges) {
      walk(edge.to);
    }
  }

  if (trigger) {
    walk(trigger.id);
  }
  
  // Append any nodes not reachable from trigger (disconnected)
  for (const n of graph.nodes) {
    if (!visited.has(n.id) && n.id !== triggerId && n.kind !== "trigger") {
      result.push(n);
    }
  }
  return result;
}

// ─── C) Signals ─────────────────────────────────────────────────────────────

const EXTERNAL_PATTERNS = [
  "httprequest",
  "gmail",
  "hubspot",
  "slack",
  "notion",
  "airtable",
  "googlesheets",
  "googledrive",
  "sheets",
  "drive",
  "telegram",
  "discord",
  "twitter",
  "stripe",
  "mailchimp",
  "sendgrid",
  "twilio",
  "jira",
  "github",
  "gitlab",
  "salesforce",
  "postgres",
  "mysql",
  "mongodb",
  "redis",
  "elasticsearch",
  "aws",
  "s3",
  "openai",
  "apollo",
];

export function getSignals(graph: WorkflowGraph | undefined): Signals {
  if (!graph) return { hasBranching: false, hasExternalCalls: false };

  // Branching: any node has more than 1 outgoing edge
  const edgesByFrom = new Map<string, number>();
  for (const edge of graph.edges) {
    edgesByFrom.set(edge.from, (edgesByFrom.get(edge.from) ?? 0) + 1);
  }
  const hasBranching = Array.from(edgesByFrom.values()).some((count) => count > 1);

  // External calls: any node type matches known patterns
  const hasExternalCalls = graph.nodes.some((n) => {
    const t = n.type.toLowerCase();
    return EXTERNAL_PATTERNS.some((p) => t.includes(p));
  });

  return { hasBranching, hasExternalCalls };
}

// ─── Mini-map builder ────────────────────────────────────────────────────────

export function buildMiniMap(graph: WorkflowGraph | undefined): MiniMap {
  if (!graph) return { mainPath: [], branches: [] };

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const nodeByLabel = new Map(graph.nodes.map((n) => [n.label, n]));

  const toMapNode = (n: WorkflowGraphNode): MiniMapNode => ({
    name: n.label,
    type: n.type,
    label: formatNodeType(n.type),
  });

  const trigger = getTriggerNode(graph);
  if (!trigger) {
    return {
      mainPath: graph.nodes.slice(0, 6).map(toMapNode),
      branches: [],
    };
  }

  // Build edge index by from node
  const edgesByFrom = new Map<string, WorkflowGraphEdge[]>();
  for (const edge of graph.edges) {
    if (!edgesByFrom.has(edge.from)) {
      edgesByFrom.set(edge.from, []);
    }
    edgesByFrom.get(edge.from)!.push(edge);
  }

  const visited = new Set<string>();
  const mainPath: MiniMapNode[] = [];
  const branches: MiniMapNode[][] = [];

  function walkChain(startId: string, limit: number): MiniMapNode[] {
    const chain: MiniMapNode[] = [];
    let current = startId;
    while (chain.length < limit) {
      if (visited.has(current)) break;
      const node = nodeById.get(current);
      if (!node) break;
      visited.add(current);
      chain.push(toMapNode(node));
      const edges = edgesByFrom.get(current) ?? [];
      if (edges.length === 0) break;
      
      // First edge is main path
      const mainEdge = edges[0];
      // Additional edges are branches
      for (let i = 1; i < edges.length && branches.length < 2; i++) {
        const branchEdge = edges[i];
        if (!visited.has(branchEdge.to)) {
          branches.push(
            walkBranch(branchEdge.to, Math.max(1, limit - chain.length))
          );
        }
      }
      current = mainEdge.to;
    }
    return chain;
  }

  function walkBranch(startId: string, limit: number): MiniMapNode[] {
    const chain: MiniMapNode[] = [];
    let current = startId;
    while (chain.length < limit) {
      if (visited.has(current)) break;
      const node = nodeById.get(current);
      if (!node) break;
      visited.add(current);
      chain.push(toMapNode(node));
      const edges = edgesByFrom.get(current) ?? [];
      if (edges.length === 0) break;
      current = edges[0].to;
    }
    return chain;
  }

  mainPath.push(...walkChain(trigger.id, 6));
  return { mainPath, branches };
}
