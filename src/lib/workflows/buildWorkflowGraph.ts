export type ReactFlowNode = {
  id: string;
  type: string;
  data: {
    label: string;
    node: unknown;
    service?: string;
    operation?: string;
    aiSummary?: string | null;
  };
};

export type ReactFlowEdge = {
  id: string;
  source: string;
  target: string;
  type: "smoothstep";
};

type NormalizedWorkflowNode = {
  id: string;
  name: string;
  type: string;
  nextNodes?: unknown;
  next?: unknown;
};

type NormalizedWorkflowLike = {
  nodes?: Record<string, NormalizedWorkflowNode> | NormalizedWorkflowNode[];
  graph?: {
    nodes: Array<{
      id: string;
      label?: string;
      name?: string;
      kind?: string;
      type: string;
      service?: string;
    }>;
    edges: Array<{ from: string; to: string }>;
  };
};

function asId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const maybe = value as { id?: unknown; nodeId?: unknown; target?: unknown };
    if (typeof maybe.id === "string" && maybe.id.trim()) return maybe.id;
    if (typeof maybe.nodeId === "string" && maybe.nodeId.trim()) return maybe.nodeId;
    if (typeof maybe.target === "string" && maybe.target.trim()) return maybe.target;
  }
  return null;
}

function collectTargets(node: NormalizedWorkflowNode): string[] {
  const candidates: unknown[] = [];

  if (Array.isArray(node.nextNodes)) candidates.push(...node.nextNodes);
  else if (node.nextNodes != null) candidates.push(node.nextNodes);

  if (Array.isArray(node.next)) candidates.push(...node.next);
  else if (node.next != null) candidates.push(node.next);

  const targets: string[] = [];
  for (const c of candidates) {
    const id = asId(c);
    if (id) targets.push(id);
  }
  return targets;
}

function normalizeWorkflowNodes(
  workflow: NormalizedWorkflowLike,
): NormalizedWorkflowNode[] {
  const raw = workflow.nodes;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.values(raw);
}

function formatServiceDisplay(service: string): string {
  return service
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function getServiceLabelFromType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("webhook")) return "Webhook";
  if (t.includes("if ") || t === "if") return "IF";
  if (t.includes("switch")) return "Switch";
  if (t.includes("hubspot")) return "HubSpot";
  if (t.includes("gmail")) return "Gmail";
  if (t.includes("slack")) return "Slack";
  if (t.includes("httprequest")) return "HTTP Request";
  if (t.includes("schedule")) return "Schedule";
  if (t.includes("manual")) return "Manual";
  const raw = type.includes(".") ? type.split(".").pop()! : type;
  const words = raw.replace(/([a-z])([A-Z])/g, "$1 $2").split(/[\s_-]+/);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function resolveServiceLabel(node: { service?: string; type: string }): string {
  if (typeof node.service === "string" && node.service.trim()) {
    return formatServiceDisplay(node.service.trim());
  }
  return getServiceLabelFromType(node.type);
}

function isAgentType(type: string): boolean {
  return type.toLowerCase().includes("ai-local-agent");
}

/**
 * Convert a normalized workflow into React Flow nodes and edges.
 *
 * - Does not compute positions (layout is handled elsewhere).
 * - Edges are derived from node relationships via `nextNodes` / `next`.
 */
export function buildWorkflowGraph(workflow: NormalizedWorkflowLike): {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
} {
  // Provider-agnostic graph case (Workflow.graph)
  if (workflow.graph) {
    const { nodes: graphNodes, edges: graphEdges } = workflow.graph;

    const outgoingCount = new Map<string, number>();
    for (const n of graphNodes) outgoingCount.set(n.id, 0);
    for (const e of graphEdges)
      outgoingCount.set(e.from, (outgoingCount.get(e.from) ?? 0) + 1);

    const nodes: ReactFlowNode[] = graphNodes.map((node) => {
      const hasOutgoing = (outgoingCount.get(node.id) ?? 0) > 0;
      const kind = (node.kind ?? "").toLowerCase();

      const rfType =
        kind === "trigger"
          ? "trigger"
          : kind === "router"
            ? "condition"
            : isAgentType(node.type)
              ? "agent"
              : !hasOutgoing
                ? "output"
                : "action";

      const gn = node as { operation?: string; action?: string; aiSummary?: string | null };
      const operation = gn.operation ?? gn.action ?? undefined;
      const aiSummary = gn.aiSummary ?? null;

      return {
        id: node.id,
        type: rfType,
        data: {
          label: (node.label ?? node.name ?? node.id) as string,
          service: resolveServiceLabel(node),
          operation,
          aiSummary,
          node,
        },
      };
    });

    const edges: ReactFlowEdge[] = [];
    const seen = new Set<string>();
    for (const e of graphEdges) {
      const id = `${e.from}-${e.to}`;
      if (seen.has(id)) continue;
      seen.add(id);
      edges.push({
        id,
        source: e.from,
        target: e.to,
        type: "smoothstep",
      });
    }

    return { nodes, edges };
  }

  const workflowNodes = normalizeWorkflowNodes(workflow);

  const nodes: ReactFlowNode[] = workflowNodes.map((node) => ({
    id: node.id,
    type: node.type,
    data: {
      label: node.name,
      service: resolveServiceLabel(node),
      node,
    },
  }));

  const nodeIdSet = new Set(workflowNodes.map((n) => n.id));
  const edges: ReactFlowEdge[] = [];
  const seen = new Set<string>();

  for (const sourceNode of workflowNodes) {
    const targets = collectTargets(sourceNode);
    for (const target of targets) {
      // Skip dangling edges to nodes not in this workflow payload.
      if (!nodeIdSet.has(target)) continue;

      const id = `${sourceNode.id}-${target}`;
      if (seen.has(id)) continue;
      seen.add(id);

      edges.push({
        id,
        source: sourceNode.id,
        target,
        type: "smoothstep",
      });
    }
  }

  return { nodes, edges };
}
