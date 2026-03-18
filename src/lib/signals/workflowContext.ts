import type { WorkflowWithSignals } from "./types";

export type WorkflowContext = {
  /**
   * Map of structural workflow fingerprint → workflow ids that share that fingerprint.
   * Fingerprint shape: `service1>service2>service3` built from workflow.graph.nodes.
   */
  fingerprints: Map<string, string[]>;
  /**
   * Map of external service → set of workflow ids that use it.
   */
  servicesUsage: Map<string, Set<string>>;
  /**
   * Reverse lookup: workflow id → fingerprint.
   */
  workflowIdToFingerprint: Map<string, string>;
  /**
   * Fan-out (number of distinct destinations) per workflow.
   */
  fanOutByWorkflowId: Map<string, number>;
  /**
   * Orphan services computed from servicesUsage, keyed by workflow id.
   */
  orphanServicesByWorkflowId: Map<string, string[]>;
};

type GraphNode = {
  id: string;
  service?: string;
  type?: string;
  category?: string;
  action?: string;
};

export const INTERNAL_SERVICES = [
  "webhook",
  "cron",
  "schedule",
  "if",
  "merge",
  "switch",
  "set",
  "function",
  "tools",
] as const;

export function isDestination(service: string): boolean {
  const normalized = service.toLowerCase().trim();
  if (!normalized) return false;
  return !INTERNAL_SERVICES.includes(normalized as (typeof INTERNAL_SERVICES)[number]);
}

function getGraphNodes(workflow: WorkflowWithSignals): GraphNode[] {
  const rawNodes = workflow.graph && Array.isArray(workflow.graph.nodes)
    ? workflow.graph.nodes
    : [];

  return rawNodes
    .map((n) => {
      const id = typeof n.id === "string" ? n.id : undefined;
      if (!id) return null;
      const node: GraphNode = { id };
      if (typeof n.service === "string") node.service = n.service;
      if (typeof n.type === "string") node.type = n.type;
      if (typeof n.category === "string") node.category = n.category;
      if (typeof n.action === "string") node.action = n.action;
      return node;
    })
    .filter((n): n is GraphNode => n !== null);
}

export function getTriggerService(workflow: WorkflowWithSignals): string {
  const graphNodes = getGraphNodes(workflow);
  const triggerServices = new Set<string>();

  for (const node of graphNodes) {
    const category = (node.category ?? "").toString().toLowerCase();
    const serviceRaw = (node.service ?? "").toString().toLowerCase().trim();
    if (!serviceRaw) continue;
    if (category === "trigger") {
      triggerServices.add(serviceRaw);
    }
  }

  return Array.from(triggerServices).sort()[0] ?? "unknown_trigger";
}

export function getDestinationServices(workflow: WorkflowWithSignals): string[] {
  const graphNodes = getGraphNodes(workflow);
  const destinationServices = new Set<string>();

  for (const node of graphNodes) {
    const serviceRaw = (node.service ?? "").toString().toLowerCase().trim();
    if (!serviceRaw) continue;
    if (isDestination(serviceRaw)) {
      destinationServices.add(serviceRaw);
    }
  }

  return Array.from(destinationServices).sort();
}

const DEBUG_WORKFLOWS = [
  "cmmp1ggxa015j2ghccdhy5rz8",
  "cmmp1g8i7014s2ghcbehcj07m",
];

export function buildWorkflowContext(
  workflows: WorkflowWithSignals[],
): WorkflowContext {
  const fingerprints = new Map<string, string[]>();
  const servicesUsage = new Map<string, Set<string>>();
  const workflowIdToFingerprint = new Map<string, string>();
  const fanOutByWorkflowId = new Map<string, number>();

  for (const wf of workflows) {
    const graphNodes = getGraphNodes(wf);

    // Structural fingerprint based purely on node sequence (service only).
    const servicesSequence = graphNodes
      .map((node) => {
        const raw = (node.service ?? "").toString().toLowerCase().trim();
        return raw;
      })
      .filter((s) => s.length > 0);

    // Skip workflows with less than 2 nodes in the fingerprint.
    let fingerprint: string | undefined;
    if (servicesSequence.length >= 2) {
      fingerprint = servicesSequence.join(">");

      workflowIdToFingerprint.set(wf.id, fingerprint);

      if (!fingerprints.has(fingerprint)) {
        fingerprints.set(fingerprint, []);
      }
      fingerprints.get(fingerprint)!.push(wf.id);
    }

    if (DEBUG_WORKFLOWS.includes(wf.id)) {
      // eslint-disable-next-line no-console
      console.log("DUPLICATE_DEBUG", {
        workflowId: wf.id,
        workflowName: wf.name,
        nodes: graphNodes.map((node) => ({
          service: node.service,
          action: node.action,
          category: node.category,
        })),
        servicesSequence,
        fingerprint,
      });
    }

    // Fan-out: number of distinct destinations, based only on write/notify nodes.
    const destinations = new Set<string>();
    for (const node of graphNodes) {
      const category = (node.category ?? "").toString().toLowerCase();
      if (category !== "write" && category !== "notify") continue;
      const serviceRaw = (node.service ?? "").toString().toLowerCase().trim();
      if (!serviceRaw) continue;
      destinations.add(serviceRaw);
    }
    fanOutByWorkflowId.set(wf.id, destinations.size);

    // External services for orphan_service (skip pure orchestration).
    const allExternalServices = new Set<string>();
    for (const node of graphNodes) {
      const category = (node.category ?? "").toString().toLowerCase();
      const serviceRaw = (node.service ?? "").toString().toLowerCase().trim();
      if (!serviceRaw) continue;
      if (
        category === "write" ||
        category === "notify" ||
        category === "read"
      ) {
        allExternalServices.add(serviceRaw);
      }
    }

    for (const service of allExternalServices) {
      if (!servicesUsage.has(service)) {
        servicesUsage.set(service, new Set<string>());
      }
      servicesUsage.get(service)!.add(wf.id);
    }
  }

  const orphanServicesByWorkflowId = new Map<string, string[]>();
  for (const [service, wfIds] of servicesUsage.entries()) {
    if (wfIds.size === 1) {
      const [wfId] = Array.from(wfIds);
      const list = orphanServicesByWorkflowId.get(wfId) ?? [];
      list.push(service);
      orphanServicesByWorkflowId.set(wfId, list);
    }
  }

  const context: WorkflowContext = {
    fingerprints,
    servicesUsage,
    workflowIdToFingerprint,
    fanOutByWorkflowId,
    orphanServicesByWorkflowId,
  };

  if (process.env.NODE_ENV === "development") {
    for (const wf of workflows) {
      const fingerprint = workflowIdToFingerprint.get(wf.id);
      if (!fingerprint) continue;
      // Temporary debug log for structural fingerprints.
      // eslint-disable-next-line no-console
      console.log("WORKFLOW_FINGERPRINT", {
        workflowId: wf.id,
        fingerprint,
      });
    }
  }

  return context;
}

