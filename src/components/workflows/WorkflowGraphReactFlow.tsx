"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  MarkerType,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Workflow } from "@/lib/providers/types";
import {
  buildWorkflowGraph,
  type ReactFlowNode,
  type ReactFlowEdge,
} from "@/lib/workflows/buildWorkflowGraph";

import { TriggerNode } from "./nodes/TriggerNode";
import { ActionNode } from "./nodes/ActionNode";
import { AgentNode } from "./nodes/AgentNode";
import { OutputNode } from "./nodes/OutputNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { ToolNode } from "./nodes/ToolNode";

// ─── Custom node type registry (stable reference — defined at module level) ───

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  agent: AgentNode,
  output: OutputNode,
  condition: ConditionNode,
  tool: ToolNode,
};

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_W = 220;
const NODE_H_ESTIMATE = 100; // used for container sizing before DOM measurement
const PADDING = 20;
const MIN_CONTAINER_H = 200;

const MAIN_SPACING_X = 340; // NODE_W(220) + gap(120)
const TOOL_OFFSET_X = 340;
const TOOL_SPACING_Y = 140;

const TYPE_ORDER: Record<string, number> = {
  trigger: 0,
  agent: 1,
  action: 2,
  output: 3,
};

const EDGE_STYLE = { stroke: "#64748b", strokeWidth: 2 };

// ─── CSS ──────────────────────────────────────────────────────────────────────

const STYLES = `
.react-flow__node-trigger,
.react-flow__node-action,
.react-flow__node-agent,
.react-flow__node-output,
.react-flow__node-condition,
.react-flow__node-tool {
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  border-radius: 0 !important;
  width: auto !important;
  font-size: inherit !important;
  color: inherit !important;
  text-align: inherit !important;
}

.react-flow__renderer {
  width: 100px !important;
  height: 100px !important;
}

.react-flow__viewport {
  width: 100%;
  height: 100%;
}

.react-flow__edgelabel-renderer {
  width: 100%;
  height: 100%;
}

.react-flow__edges {
  width: 100%;
  height: 100%;
  z-index: 1;
}

.react-flow__marker {
  width: 100%;
  height: 100%;
}

.react-flow__nodes {
  z-index: 2;
}

.workflow-preview {
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
}
`;

// ─── Deterministic layout ─────────────────────────────────────────────────────

/**
 * Derive agent → tool relationships from the edge structure so the layout
 * doesn't depend on `meta.isAgentTool` surviving the database round-trip.
 *
 * A node is treated as an agent tool when:
 *  1. Every incoming edge originates from an agent node
 *  2. It has zero outgoing edges (leaf node)
 *  3. It is not an agent itself
 *
 * Falls back to `meta.isAgentTool` / `meta.parentAgentId` when present.
 */
function buildAgentToolMap(
  rfNodes: ReactFlowNode[],
  rfEdges: ReactFlowEdge[],
): Map<string, string> {
  const agentIds = new Set(
    rfNodes.filter((n) => n.type === "agent").map((n) => n.id),
  );

  const outCount = new Map<string, number>();
  const incoming = new Map<string, string[]>();
  for (const n of rfNodes) {
    outCount.set(n.id, 0);
    incoming.set(n.id, []);
  }
  for (const e of rfEdges) {
    outCount.set(e.source, (outCount.get(e.source) ?? 0) + 1);
    incoming.get(e.target)?.push(e.source);
  }

  const toolParent = new Map<string, string>();

  for (const node of rfNodes) {
    if (agentIds.has(node.id)) continue;
    if ((outCount.get(node.id) ?? 0) > 0) continue;

    const sources = incoming.get(node.id) ?? [];
    if (sources.length > 0 && sources.every((s) => agentIds.has(s))) {
      toolParent.set(node.id, sources[0]);
      continue;
    }

    const meta = (node.data.node as Record<string, unknown> | undefined)
      ?.meta as { isAgentTool?: boolean; parentAgentId?: string } | undefined;
    if (meta?.isAgentTool && meta.parentAgentId) {
      toolParent.set(node.id, meta.parentAgentId);
    }
  }

  return toolParent;
}

/**
 * Position nodes deterministically:
 *
 * Rule 1 — Sort by type so main flow reads trigger → agent → action → output.
 * Rule 2 — Main-flow nodes placed left → right at a fixed Y.
 * Rule 3 — Agent tools stack vertically below their parent agent,
 *           re-typed as "tool" for the ToolNode renderer.
 *
 *   Trigger → Agent
 *                 ├ Tool
 *                 ├ Tool
 *                 └ Tool
 */
function layoutPreviewNodes(
  rfNodes: ReactFlowNode[],
  rfEdges: ReactFlowEdge[],
): (ReactFlowNode & { position: { x: number; y: number } })[] {
  const toolParent = buildAgentToolMap(rfNodes, rfEdges);

  const sorted = [...rfNodes].sort((a, b) => {
    const aOrder = TYPE_ORDER[a.type] ?? 99;
    const bOrder = TYPE_ORDER[b.type] ?? 99;
    return aOrder - bOrder;
  });

  // Pass 1 — position relative to y = 0
  const positioned = new Map<string, { x: number; y: number }>();

  let mainIndex = 0;
  for (const node of sorted) {
    if (!toolParent.has(node.id)) {
      positioned.set(node.id, {
        x: mainIndex * MAIN_SPACING_X + PADDING,
        y: 0,
      });
      mainIndex++;
    }
  }

  const agentToolCounts = new Map<string, number>();
  for (const node of sorted) {
    const parentId = toolParent.get(node.id);
    if (!parentId) continue;
    const agentPos = positioned.get(parentId);
    if (!agentPos) continue;

    const idx = agentToolCounts.get(parentId) ?? 0;
    agentToolCounts.set(parentId, idx + 1);

    positioned.set(node.id, {
      x: agentPos.x + TOOL_OFFSET_X,
      y: agentPos.y + (idx + 1) * TOOL_SPACING_Y,
    });
  }

  // Pass 2 — center vertically within the container
  const allY = [...positioned.values()].map((p) => p.y);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const contentH = maxY - minY + NODE_H_ESTIMATE;
  const containerH = Math.max(contentH + PADDING * 2, MIN_CONTAINER_H);
  const offsetY = Math.round((containerH - contentH) / 2) - minY;

  for (const [id, pos] of positioned) {
    positioned.set(id, { x: pos.x, y: pos.y + offsetY });
  }

  return sorted.map((node) => ({
    ...node,
    type: toolParent.has(node.id) ? "tool" : node.type,
    position: positioned.get(node.id) ?? { x: 0, y: 0 },
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WorkflowGraphReactFlowProps {
  workflow: Workflow;
}

export function WorkflowGraphReactFlow({
  workflow,
}: WorkflowGraphReactFlowProps) {
  const [mounted, setMounted] = useState(false);
  const [measuredH, setMeasuredH] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const nodeEls = containerRef.current.querySelectorAll<HTMLElement>(
      ".react-flow__node"
    );
    if (nodeEls.length === 0) return;
    let maxBottom = 0;
    nodeEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const parentRect = containerRef.current!.getBoundingClientRect();
      const bottom = rect.bottom - parentRect.top;
      if (bottom > maxBottom) maxBottom = bottom;
    });
    if (maxBottom > 0) setMeasuredH(maxBottom + PADDING);
  });

  const graph = workflow.graph;

  if (!graph || graph.nodes.length === 0) {
    return (
      <p className="py-12 text-center text-[13px] text-gray-400">
        No nodes to display.
      </p>
    );
  }

  if (!mounted) {
    return <div className="workflow-preview" style={{ height: MIN_CONTAINER_H }} />;
  }

  const { nodes, edges } = buildWorkflowGraph(workflow);
  const layoutedNodes = layoutPreviewNodes(nodes, edges);

  const maxX = Math.max(...layoutedNodes.map((n) => n.position.x));
  const maxY = Math.max(...layoutedNodes.map((n) => n.position.y));
  const containerW = maxX + NODE_W + PADDING;
  const containerH = Math.max(maxY + NODE_H_ESTIMATE + PADDING, 200);

  const finalH = measuredH ?? containerH;

  return (
    <>
      <style>{STYLES}</style>
      <div className="workflow-preview" style={{ height: "fit-content" }}>
        <div
          ref={containerRef}
          style={{ width: containerW, height: finalH, minWidth: "100%" }}
        >
          <ReactFlow
            nodes={layoutedNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView={false}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={false}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            selectionOnDrag={false}
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: false,
              style: EDGE_STYLE,
              markerEnd: {
                type: MarkerType.ArrowClosed,
              },
            }}
            proOptions={{ hideAttribution: true }}
          />
        </div>
      </div>
    </>
  );
}
