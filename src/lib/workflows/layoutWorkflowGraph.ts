import dagre from "dagre";

type ReactFlowNodeLike = {
  id: string;
  type?: string;
  data?: unknown;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
};

type ReactFlowEdgeLike = {
  source: string;
  target: string;
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;

/**
 * Compute node positions using Dagre (left-to-right).
 * Returns a new nodes array with `position: {x,y}` set.
 *
 * Edges are not modified.
 */
export function layoutWorkflowGraph<TNode extends ReactFlowNodeLike>(
  nodes: TNode[],
  edges: ReactFlowEdgeLike[],
): TNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR" });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id) as { x: number; y: number } | undefined;
    if (!pos) return { ...node, position: node.position ?? { x: 0, y: 0 } };

    // Dagre gives the center point; React Flow expects top-left.
    const x = pos.x - NODE_WIDTH / 2;
    const y = pos.y - NODE_HEIGHT / 2;

    return {
      ...node,
      position: { x, y },
    };
  });
}

