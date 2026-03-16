export type SystemServiceNode = {
  service: string;
  workflows: Set<string>;
};

export type SystemEdge = {
  from: string;
  to: string;
  workflowId: string;
};

export type SystemGraph = {
  services: Map<string, SystemServiceNode>;
  edges: SystemEdge[];
};

const TECHNICAL_SERVICES = new Set([
  "webhook",
  "webhooks",
  "cron",
  "tools",
  "http",
]);

export function buildSystemGraph(workflows: any[]): SystemGraph {
  const services = new Map<string, SystemServiceNode>();
  const edges: SystemEdge[] = [];

  for (const wf of workflows) {
    const nodes = wf.graph?.nodes ?? [];
    const workflowId = wf.id;

    for (const node of nodes) {
      const service: string | undefined = node.service;
      if (!service) continue;

      if (TECHNICAL_SERVICES.has(service)) continue;

      if (!services.has(service)) {
        services.set(service, {
          service,
          workflows: new Set(),
        });
      }

      services.get(service)!.workflows.add(workflowId);
    }

    const graphEdges = wf.graph?.edges ?? [];

    for (const edge of graphEdges) {
      const fromNode = nodes.find((n: any) => n.id === edge.from);
      const toNode = nodes.find((n: any) => n.id === edge.to);

      if (!fromNode || !toNode) continue;
      if (!fromNode.service || !toNode.service) continue;

      if (
        TECHNICAL_SERVICES.has(fromNode.service) ||
        TECHNICAL_SERVICES.has(toNode.service)
      ) {
        continue;
      }

      edges.push({
        from: fromNode.service,
        to: toNode.service,
        workflowId,
      });
    }
  }

  return {
    services,
    edges,
  };
}
