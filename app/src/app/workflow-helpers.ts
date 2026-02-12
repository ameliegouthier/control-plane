// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
  parameters?: Record<string, unknown>;
}

/** n8n connection entry: a single edge from one output slot to another node */
export interface ConnectionEdge {
  node: string;
  type: string;
  index: number;
}

/**
 * n8n connections map.
 * Shape: { [sourceNodeName]: { main: ConnectionEdge[][] } }
 * `main[0]` = first output slot, `main[1]` = second output, etc.
 */
export type Connections = Record<string, { main: ConnectionEdge[][] }>;

export interface Workflow {
  id: string;
  name: string;
  active: boolean;
  nodes: WorkflowNode[];
  connections: Connections;
  updatedAt: string;
  createdAt: string;
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

/** Find the trigger node (first node whose type contains "trigger" or "webhook") */
export function getTriggerNode(nodes: WorkflowNode[]): WorkflowNode | null {
  return (
    nodes.find((n) => {
      const t = n.type.toLowerCase();
      return t.includes("trigger") || t.includes("webhook");
    }) ?? null
  );
}

/** Simple trigger kind label (kept for backward compat in mini-map) */
export function getTriggerLabel(nodes: WorkflowNode[]): string {
  return getTriggerSummary(nodes).label;
}

/**
 * Turn "n8n-nodes-base.httpRequest" into "HTTP Request".
 * Strips vendor prefix, splits camelCase, title-cases.
 */
export function formatNodeType(type: string): string {
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

export function getTriggerSummary(nodes: WorkflowNode[]): TriggerSummary {
  const trigger = getTriggerNode(nodes);
  if (!trigger) return { label: "Manual", kind: "manual", config: {} };

  const t = trigger.type.toLowerCase();
  const params = trigger.parameters ?? {};

  // Webhook
  if (t.includes("webhook")) {
    const path = typeof params.path === "string" ? params.path : "";
    const responseMode =
      typeof params.responseMode === "string" ? params.responseMode : "";
    const config: Record<string, string> = {};
    if (path) config.path = path;
    if (responseMode) config.responseMode = responseMode;

    const label = path ? `Webhook · ${path}` : "Webhook";
    return { label, kind: "webhook", config };
  }

  // Schedule
  if (t.includes("schedule") || t.includes("cron")) {
    const cadence = deriveScheduleCadence(params);
    const config: Record<string, string> = {};
    if (cadence !== "custom") config.interval = cadence;
    const label = `Schedule · ${cadence}`;
    return { label, kind: "schedule", config };
  }

  // Manual
  if (t.includes("manual")) {
    return { label: "Manual", kind: "manual", config: {} };
  }

  return { label: formatNodeType(trigger.type), kind: "other", config: {} };
}

/** Best-effort human cadence from schedule trigger parameters */
function deriveScheduleCadence(params: Record<string, unknown>): string {
  // n8n scheduleTrigger stores rule as { interval: [{field, …}] }
  const rule = params.rule as Record<string, unknown> | undefined;
  if (rule) {
    const intervals = rule.interval as
      | Array<Record<string, unknown>>
      | undefined;
    if (intervals && intervals.length > 0) {
      const first = intervals[0];
      const field = first.field as string | undefined;
      if (field === "seconds") return `every ${first.secondsInterval ?? 30}s`;
      if (field === "minutes") return `every ${first.minutesInterval ?? 5} min`;
      if (field === "hours") return `every ${first.hoursInterval ?? 1}h`;
      if (field === "days") return "daily";
      if (field === "weeks") return "weekly";
      if (field === "cronExpression")
        return `cron: ${first.expression ?? "…"}`;
    }
  }
  // Fallback: check for top-level interval/cronExpression
  if (typeof params.interval === "string") return params.interval;
  if (typeof params.cronExpression === "string")
    return `cron: ${params.cronExpression}`;
  return "custom";
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
 * Nodes are ordered via connection walk when possible.
 */
export function getActionPills(
  nodes: WorkflowNode[],
  connections: Connections,
  max = 4
): ActionPills {
  const trigger = getTriggerNode(nodes);
  const ordered = getOrderedNonTriggerNodes(nodes, connections, trigger);
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

/** Walk connections from trigger to produce non-trigger nodes in logical order */
function getOrderedNonTriggerNodes(
  nodes: WorkflowNode[],
  connections: Connections,
  trigger: WorkflowNode | null
): WorkflowNode[] {
  const nodeByName = new Map(nodes.map((n) => [n.name, n]));
  const triggerName = trigger?.name;
  const visited = new Set<string>();
  const result: WorkflowNode[] = [];

  function walk(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    const node = nodeByName.get(name);
    if (node && node.name !== triggerName) result.push(node);
    const outs = connections[name]?.main;
    if (!outs) return;
    for (const slot of outs) {
      for (const edge of slot) {
        walk(edge.node);
      }
    }
  }

  if (trigger) {
    walk(trigger.name);
  }
  // Append any nodes not reachable from trigger (disconnected)
  for (const n of nodes) {
    if (!visited.has(n.name) && n.name !== triggerName) {
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

export function getSignals(
  nodes: WorkflowNode[],
  connections: Connections
): Signals {
  // Branching: any node has more than 1 output slot
  const hasBranching = Object.values(connections).some(
    (c) => c.main && c.main.length > 1
  );

  // External calls: any node type matches known patterns
  const hasExternalCalls = nodes.some((n) => {
    const t = n.type.toLowerCase();
    return EXTERNAL_PATTERNS.some((p) => t.includes(p));
  });

  return { hasBranching, hasExternalCalls };
}

// ─── Mini-map builder (unchanged) ───────────────────────────────────────────

export function buildMiniMap(
  nodes: WorkflowNode[],
  connections: Connections
): MiniMap {
  const nodeByName = new Map(nodes.map((n) => [n.name, n]));

  const toMapNode = (n: WorkflowNode): MiniMapNode => ({
    name: n.name,
    type: n.type,
    label: formatNodeType(n.type),
  });

  const trigger = getTriggerNode(nodes);
  if (!trigger) {
    return {
      mainPath: nodes.slice(0, 6).map(toMapNode),
      branches: [],
    };
  }

  const visited = new Set<string>();
  const mainPath: MiniMapNode[] = [];
  const branches: MiniMapNode[][] = [];

  function walkChain(startName: string, limit: number): MiniMapNode[] {
    const chain: MiniMapNode[] = [];
    let current = startName;
    while (chain.length < limit) {
      if (visited.has(current)) break;
      const node = nodeByName.get(current);
      if (!node) break;
      visited.add(current);
      chain.push(toMapNode(node));
      const outs = connections[current]?.main;
      if (!outs || outs.length === 0 || outs[0].length === 0) break;
      for (let slot = 1; slot < outs.length && branches.length < 2; slot++) {
        const branchEdges = outs[slot];
        if (branchEdges.length > 0 && !visited.has(branchEdges[0].node)) {
          branches.push(
            walkBranch(branchEdges[0].node, Math.max(1, limit - chain.length))
          );
        }
      }
      current = outs[0][0].node;
    }
    return chain;
  }

  function walkBranch(startName: string, limit: number): MiniMapNode[] {
    const chain: MiniMapNode[] = [];
    let current = startName;
    while (chain.length < limit) {
      if (visited.has(current)) break;
      const node = nodeByName.get(current);
      if (!node) break;
      visited.add(current);
      chain.push(toMapNode(node));
      const outs = connections[current]?.main;
      if (!outs || outs.length === 0 || outs[0].length === 0) break;
      current = outs[0][0].node;
    }
    return chain;
  }

  mainPath.push(...walkChain(trigger.name, 6));
  return { mainPath, branches };
}
