"use client";

import { use, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { getWorkflowById } from "@/lib/repositories/workflowsRepository";
import {
  type Workflow,
  getTriggerSummary,
  getSignals,
  buildMiniMap,
} from "../../workflow-helpers";
import type { MiniMapNode } from "../../workflow-helpers";
import {
  type WorkflowIntent,
  generateDraftIntent,
} from "@/lib/intent";
import SidebarTools from "@/app/overview/components/SidebarTools";

// ─── Icons (inline SVG, no external deps) ─────────────────────────────────────

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
function ChevronDown({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function AlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function Zap({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
function ArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
function GitBranch({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="6" cy="18" r="3" />
      <path d="M6 9a3 3 0 0 1 3-3 3 3 0 0 1 3 3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M18 9v9" />
      <path d="M6 12h8" />
    </svg>
  );
}

// ─── Optimization (carousel) ─────────────────────────────────────────────────

type OptimizationId = "branching" | "external";

interface OptimizationItem {
  id: OptimizationId;
  icon: "warning" | "zap";
  title: string;
  description: string;
  recommendedFix: string;
  impact: string[];
  showMarkResolved: boolean;
}

function getOptimizationItems(signals: { hasBranching: boolean; hasExternalCalls: boolean }): OptimizationItem[] {
  const items: OptimizationItem[] = [];
  if (signals.hasBranching) {
    items.push({
      id: "branching",
      icon: "warning",
      title: "Branching logic could be simplified",
      description: "This workflow contains multiple conditional branches.",
      recommendedFix: "Merge conditions into a single validation step.",
      impact: ["Reduces workflow complexity", "Improves maintainability"],
      showMarkResolved: true,
    });
  }
  if (signals.hasExternalCalls) {
    items.push({
      id: "external",
      icon: "zap",
      title: "External API calls detected",
      description: "This workflow calls external services (e.g. HubSpot, Gmail).",
      recommendedFix: "Add retry or fallback logic.",
      impact: ["Improves reliability", "Prevents silent failures"],
      showMarkResolved: false,
    });
  }
  return items;
}

function OptimizationCard({
  item,
  onHighlightNodes,
  onMarkResolved,
  previewSectionRef,
}: {
  item: OptimizationItem;
  onHighlightNodes: (id: OptimizationId) => void;
  onMarkResolved: (id: OptimizationId) => void;
  previewSectionRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      className="bg-white rounded-xl px-6 py-5"
      style={{ border: "1px solid rgba(0,0,0,0.07)" }}
    >
      <div className="flex items-start gap-2 mb-3">
        {item.icon === "warning" ? (
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        ) : (
          <Zap className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        )}
        <div>
          <div className="text-[14px] text-gray-900" style={{ lineHeight: 1.4 }}>
            {item.title}
          </div>
          <div className="text-[13px] text-gray-400 mt-0.5" style={{ lineHeight: 1.5 }}>
            {item.description}
          </div>
        </div>
      </div>
      <div className="ml-6">
        <div className="text-[11px] tracking-[0.08em] uppercase text-amber-600 mb-1">
          Recommended fix:
        </div>
        <div className="text-[13px] text-gray-700 mb-3" style={{ lineHeight: 1.5 }}>
          {item.recommendedFix}
        </div>
        <div className="text-[11px] tracking-[0.08em] uppercase text-amber-600 mb-1">
          Impact:
        </div>
        <div className="space-y-0.5 mb-4">
          {item.impact.map((line, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px] text-gray-600" style={{ lineHeight: 1.5 }}>
              <span className="text-gray-300">›</span>
              {line}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              previewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              onHighlightNodes(item.id);
            }}
            className="text-[12px] text-gray-500 px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-50 cursor-default"
            style={{ border: "1px solid rgba(0,0,0,0.1)" }}
          >
            Highlight nodes
          </button>
          {item.showMarkResolved && (
            <button
              type="button"
              onClick={() => onMarkResolved(item.id)}
              className="text-[12px] text-gray-500 px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-50 cursor-default"
              style={{ border: "1px solid rgba(0,0,0,0.1)" }}
            >
              Mark as resolved
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Graph: nodeTheme (from WorkflowDetailPage-Guidelines) ────────────────────

type DetailNodeType = "trigger" | "action" | "condition" | "destination";

interface DetailNode {
  id: string;
  label: string;
  type: DetailNodeType;
  service?: string;
  databaseId?: string;
  channelId?: string;
}

const nodeTheme: Record<
  DetailNodeType,
  { bg: string; border: string; text: string; pillBg: string; pillText: string; label: string; dotBg: string }
> = {
  trigger: { bg: "#f0f5ff", border: "#c7d9f9", text: "#2554c7", pillBg: "#e0ecff", pillText: "#2554c7", label: "Trigger", dotBg: "#4d7cee" },
  condition: { bg: "#fffcf0", border: "#f5e1a0", text: "#9c5e10", pillBg: "#fef3cd", pillText: "#9c5e10", label: "Condition", dotBg: "#e8a830" },
  destination: { bg: "#f0faf5", border: "#a8e6cf", text: "#1a7a52", pillBg: "#d4f5e4", pillText: "#1a7a52", label: "Output", dotBg: "#34b87a" },
  action: { bg: "#f8f9fb", border: "#dde1e8", text: "#4a5568", pillBg: "#edf0f4", pillText: "#4a5568", label: "Action", dotBg: "#8e99a8" },
};

/** Node type by position in the chain only. First = Trigger, last = Output, middle = Condition (if type "if") else Action. */
function getDetailNodeTypeByPosition(
  rawType: string,
  index: number,
  chainLength: number,
  isMainChain: boolean
): DetailNodeType {
  if (chainLength <= 0) return "action";
  if (isMainChain && index === 0) return "trigger";
  if (index === chainLength - 1) return "destination";
  const t = rawType.toLowerCase();
  if (t.includes("if") || t === "if") return "condition";
  return "action";
}

function getServiceLabel(type: string): string {
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
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function toDetailNode(
  node: MiniMapNode,
  index: number,
  chainLength: number,
  isMainChain: boolean
): DetailNode {
  return {
    id: `${node.name}-${index}-${isMainChain ? "m" : "b"}`,
    label: node.name,
    type: getDetailNodeTypeByPosition(node.type, index, chainLength, isMainChain),
    service: getServiceLabel(node.type),
    ...(node.databaseId != null && { databaseId: node.databaseId }),
    ...(node.channelId != null && { channelId: node.channelId }),
  };
}

function buildDetailGraph(workflow: Workflow): { nodes: DetailNode[]; branches?: { fromNodeLabel: string; nodes: DetailNode[] }[] } {
  const { mainPath, branches, conditionIndex } = buildMiniMap(workflow.graph);
  if (mainPath.length === 0) return { nodes: [] };
  const nodes: DetailNode[] = mainPath.map((n, i) => toDetailNode(n, i, mainPath.length, true));
  // When the graph has a fork, ensure the fork node is typed as condition so the UI shows TRUE/FALSE branches
  if (conditionIndex != null && conditionIndex >= 0 && conditionIndex < nodes.length) {
    nodes[conditionIndex] = { ...nodes[conditionIndex], type: "condition" };
  }
  if (branches.length === 0) return { nodes };
  const conditionLabel = mainPath[conditionIndex ?? mainPath.length - 1]?.name ?? mainPath[mainPath.length - 1].name;
  const falsePathNodes = branches[0];
  const falsePath: DetailNode[] = falsePathNodes.map((n, i) =>
    toDetailNode(n, i, falsePathNodes.length, false)
  );
  return {
    nodes,
    branches: [{ fromNodeLabel: conditionLabel, nodes: falsePath }],
  };
}

// ─── DotGrid ─────────────────────────────────────────────────────────────────

function DotGrid() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: "radial-gradient(circle, #e5e7eb 0.7px, transparent 0.7px)",
        backgroundSize: "20px 20px",
        opacity: 0.5,
      }}
    />
  );
}

// ─── Connector (dashed SVG arrow) ────────────────────────────────────────────

function Connector({ length = 48 }: { length?: number }) {
  return (
    <div className="flex items-center justify-center shrink-0 self-center mr-2" style={{ width: length, height: 20 }}>
      <svg className="block" width={length} height={20} viewBox={`0 0 ${length} 20`} fill="none">
        <line x1="0" y1="10" x2={length - 6} y2="10" stroke="#dde1e8" strokeWidth="1.5" strokeDasharray="4 3" />
        <polygon points={`${length - 7},6 ${length},10 ${length - 7},14`} fill="#c5ccd6" />
      </svg>
    </div>
  );
}

// ─── GraphNode ───────────────────────────────────────────────────────────────

function GraphNode({ node }: { node: DetailNode }) {
  const t = nodeTheme[node.type];
  return (
    <div className="flex flex-col items-center shrink-0" style={{ width: 180 }}>
      <div
        className="relative w-full rounded-xl transition-all duration-200 hover:shadow-sm"
        style={{
          background: t.bg,
          border: `1.5px solid ${t.border}`,
          padding: "10px 14px",
        }}
      >
        <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
          <div className="rounded-full shrink-0" style={{ width: 5, height: 5, background: t.dotBg }} />
          <span className="text-[9px] tracking-[0.06em] uppercase truncate" style={{ color: t.pillText, opacity: 0.8 }}>
            {t.label}
          </span>
        </div>
        <div className="text-[12px]" style={{ color: t.text, lineHeight: "16px" }}>
          {node.label}
        </div>
      </div>
      {node.service && (
        <span className="text-[10px] text-gray-400 mt-1.5" style={{ lineHeight: "14px" }}>
          {node.service}
        </span>
      )}
      {(node.databaseId != null || node.channelId != null) && (
        <div className="text-[10px] text-gray-500 mt-1 space-y-0.5" style={{ lineHeight: "14px" }}>
          {node.databaseId != null && <div>Database: {node.databaseId}</div>}
          {node.channelId != null && <div>Channel: {node.channelId}</div>}
        </div>
      )}
    </div>
  );
}

// ─── GraphLegend ─────────────────────────────────────────────────────────────

function GraphLegend() {
  const items: { label: string; color: string }[] = [
    { label: "Trigger", color: "#4d7cee" },
    { label: "Action", color: "#8e99a8" },
    { label: "Condition", color: "#e8a830" },
    { label: "Output", color: "#34b87a" },
  ];
  return (
    <div className="flex items-center gap-4 mt-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className="rounded-full" style={{ width: 6, height: 6, background: item.color }} />
          <span className="text-[10px] text-gray-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── BranchLabel ───────────────────────────────────────────────────────────

function BranchLabel({ text, color }: { text: string; color: "green" | "red" }) {
  const colors =
    color === "green"
      ? { bg: "#ecfdf5", text: "#059669", border: "#a7f3d0" }
      : { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" };
  return (
    <span
      className="text-[9px] tracking-[0.04em] uppercase px-2 py-0.5 rounded-full mr-2 shrink-0"
      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      {text}
    </span>
  );
}

// ─── Split column (vertical dotted line; horizontal arrows to TRUE/FALSE branches) ───

const SPLIT_COL_WIDTH = 56;
const ROW_H = 100;
const SPLIT_TOTAL_H = ROW_H * 3;
const ROW1_CY = ROW_H / 2;
const ROW2_CY = ROW_H + ROW_H / 2;
const ROW3_CY = ROW_H * 2 + ROW_H / 2;
const SPLIT_CX = SPLIT_COL_WIDTH / 2;

/** Vertical split column: line from condition; vertical line; two horizontal branches (TRUE, FALSE) to the right. */
function SplitColumn() {
  return (
    <div
      className="shrink-0 flex justify-center"
      style={{ width: SPLIT_COL_WIDTH, minHeight: SPLIT_TOTAL_H }}
    >
      <svg
        width={SPLIT_COL_WIDTH}
        height={SPLIT_TOTAL_H}
        viewBox={`0 0 ${SPLIT_COL_WIDTH} ${SPLIT_TOTAL_H}`}
        fill="none"
        className="overflow-visible"
      >
        {/* Horizontal: from condition (left) into split column */}
        <line x1={0} y1={ROW1_CY} x2={SPLIT_CX} y2={ROW1_CY} stroke="#c5ccd6" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* Vertical dotted line (split) from row 1 center to bottom */}
        <line x1={SPLIT_CX} y1={ROW1_CY} x2={SPLIT_CX} y2={SPLIT_TOTAL_H} stroke="#c5ccd6" strokeWidth="1.5" strokeDasharray="4 3" />
        {/* Horizontal to TRUE branch (row 2) */}
        <line x1={SPLIT_CX} y1={ROW2_CY} x2={SPLIT_COL_WIDTH} y2={ROW2_CY} stroke="#c5ccd6" strokeWidth="1.5" strokeDasharray="4 3" />
        <polygon points={`${SPLIT_COL_WIDTH - 6},${ROW2_CY - 4} ${SPLIT_COL_WIDTH},${ROW2_CY} ${SPLIT_COL_WIDTH - 6},${ROW2_CY + 4}`} fill="#c5ccd6" />
        {/* Horizontal to FALSE branch (row 3) */}
        <line x1={SPLIT_CX} y1={ROW3_CY} x2={SPLIT_COL_WIDTH} y2={ROW3_CY} stroke="#c5ccd6" strokeWidth="1.5" strokeDasharray="4 3" />
        <polygon points={`${SPLIT_COL_WIDTH - 6},${ROW3_CY - 4} ${SPLIT_COL_WIDTH},${ROW3_CY} ${SPLIT_COL_WIDTH - 6},${ROW3_CY + 4}`} fill="#c5ccd6" />
      </svg>
    </div>
  );
}

// ─── WorkflowGraphPreview (4 columns: Trigger | Condition | Split | Branches) ───

function WorkflowGraphPreview({
  nodes,
  branches,
}: {
  nodes: DetailNode[];
  branches?: { fromNodeLabel: string; nodes: DetailNode[] }[];
}) {
  const hasBranches = branches && branches.length > 0 && branches[0].nodes.length > 0;
  const branchIndex = nodes.findIndex((n) => n.type === "condition");
  const triggerAndCondition = branchIndex >= 0 ? nodes.slice(0, branchIndex + 1) : nodes;
  const truePathNodes = branchIndex >= 0 ? nodes.slice(branchIndex + 1) : [];
  const falsePathNodes = hasBranches ? branches![0].nodes : [];

  if (nodes.length === 0) {
    return (
      <p className="py-12 text-center text-[13px] text-gray-400">
        No nodes to display.
      </p>
    );
  }

  return (
    <div className="relative overflow-auto rounded-xl w-full min-w-[900px] max-h-[70vh]">
      <DotGrid />
      <div className="relative py-12 px-10 w-full flex flex-col items-center min-w-0 mr-8">
        <div
          className="grid w-full max-w-[1100px] min-w-[900px] gap-x-2 gap-y-0"
          style={{
            gridTemplateColumns: "auto auto auto 1fr",
            gridTemplateRows: `${ROW_H}px ${ROW_H}px ${ROW_H}px`,
          }}
        >
          {/* Column 1 + 2, Row 1: Trigger → Condition (vertically centered with split column) */}
          <div className="flex items-center justify-center gap-0 col-span-2 min-w-0 self-center" style={{ gridColumn: "1 / 3", gridRow: 1 }}>
            {triggerAndCondition.map((node, i) => (
              <div key={node.id} className="flex items-center">
                {i > 0 && <Connector />}
                <GraphNode node={node} />
              </div>
            ))}
          </div>
          {/* Column 3: Vertical split (spans 3 rows); row 1 horizontal line at center (ROW_H/2) */}
          <div className="flex justify-center items-stretch" style={{ gridColumn: 3, gridRow: "1 / 4", minHeight: SPLIT_TOTAL_H }}>
            {hasBranches ? <SplitColumn /> : <Connector />}
          </div>
          {/* Column 4, Row 2: TRUE branch (aligns with split horizontal line) */}
          <div className="flex items-center gap-0 min-w-0 items-center" style={{ gridColumn: 4, gridRow: 2, alignSelf: "center" }}>
            {truePathNodes.length > 0 && (
              <>
                <BranchLabel text="True" color="green" />
                {truePathNodes.map((node, i) => (
                  <div key={node.id} className="flex items-center">
                    {i > 0 && <Connector />}
                    <GraphNode node={node} />
                  </div>
                ))}
              </>
            )}
          </div>
          {/* Column 4, Row 3: FALSE branch (aligns with split horizontal line) */}
          <div className="flex items-center gap-0 min-w-0 items-center" style={{ gridColumn: 4, gridRow: 3, alignSelf: "center" }}>
            {falsePathNodes.length > 0 && (
              <>
                <BranchLabel text="False" color="red" />
                {falsePathNodes.map((node, i) => (
                  <div key={node.id} className="flex items-center">
                    {i > 0 && <Connector />}
                    <GraphNode node={node} />
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className={`flex items-center mt-6 w-full ${hasBranches ? "justify-between" : "justify-end"}`}>
          {hasBranches && (
            <div className="flex items-center gap-1.5 text-gray-400">
              <GitBranch className="w-3 h-3" />
              <span className="text-[10px]">Conditional branching</span>
            </div>
          )}
          <GraphLegend />
        </div>
      </div>
    </div>
  );
}

// Fix: linear flow (no condition) should render all nodes in a row
function WorkflowGraphPreviewLinear({ nodes }: { nodes: DetailNode[] }) {
  if (nodes.length === 0) {
    return (
      <p className="py-12 text-center text-[13px] text-gray-400">
        No nodes to display.
      </p>
    );
  }
  return (
    <div className="relative overflow-auto rounded-xl w-full min-w-[900px] max-h-[70vh]">
      <DotGrid />
      <div className="relative py-12 px-10 w-full flex flex-col items-center min-w-0 mr-8">
        <div className="flex items-center justify-center w-full min-w-[900px]">
          <div className="flex items-center">
            {nodes.map((node, i) => (
              <div key={node.id} className="flex items-center">
                {i > 0 && <Connector />}
                <GraphNode node={node} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end mt-6 w-full">
          <GraphLegend />
        </div>
      </div>
    </div>
  );
}

// ─── Intent (collapsible) ────────────────────────────────────────────────────

function IntentField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] tracking-[0.08em] uppercase text-amber-600 mb-1">{label}</div>
      <div className="text-[13px] text-gray-700" style={{ lineHeight: 1.6 }}>
        {value}
      </div>
    </div>
  );
}

const statusConfig: Record<string, { label: string; text: string; bg: string; border: string }> = {
  active: { label: "Active", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  inactive: { label: "Paused", text: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" },
};

const toolColors: Record<string, string> = {
  n8n: "bg-orange-50 text-orange-600 border-orange-100",
  make: "bg-violet-50 text-violet-600 border-violet-100",
  zapier: "bg-amber-50 text-amber-600 border-amber-100",
  airtable: "bg-blue-50 text-blue-600 border-blue-100",
};

// ─── Main Page ───────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default function WorkflowDetailPage({ params, searchParams }: PageProps) {
  const { id: workflowId } = use(params);
  use(searchParams ?? Promise.resolve({})); // unwrap to avoid sync access

  const workflow = useMemo(() => getWorkflowById(workflowId), [workflowId]);
  const draftIntent = useMemo(() => (workflow ? generateDraftIntent(workflow) : null), [workflow]);
  const [intentOverrides, setIntentOverrides] = useState<Record<string, WorkflowIntent>>({});
  const intent = useMemo(
    () => (draftIntent ? intentOverrides[workflowId] ?? draftIntent : null),
    [draftIntent, intentOverrides, workflowId]
  );

  const [carouselPage, setCarouselPage] = useState(0);
  const [resolvedOptimizations, setResolvedOptimizations] = useState<Set<OptimizationId>>(new Set());
  const [intentExpanded, setIntentExpanded] = useState(false);
  const workflowPreviewRef = useRef<HTMLDivElement>(null);

  const handleIntentUpdate = useCallback(
    (next: WorkflowIntent) => setIntentOverrides((prev) => ({ ...prev, [workflowId]: next })),
    [workflowId]
  );
  const handleIntentReset = useCallback(() => {
    setIntentOverrides((prev) => {
      const next = { ...prev };
      delete next[workflowId];
      return next;
    });
  }, [workflowId]);
  const handleMarkResolved = useCallback((id: OptimizationId) => {
    setResolvedOptimizations((prev) => new Set(prev).add(id));
  }, []);
  const handleHighlightNodes = useCallback((id: OptimizationId) => {
    workflowPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  if (!workflow || !intent) {
    return (
      <div className="bg-[#fafafa] min-h-screen">
        <SidebarTools workflows={workflow ? [workflow] : []} selectedTool={selectedTool} onSelectTool={setSelectedTool} />
        <div className="ml-[80px] px-8 py-6">
          <div className="max-w-[1360px] mx-auto">
            <div className="flex flex-col items-center justify-center py-24">
              <h1 className="text-gray-900" style={{ fontSize: "20px", lineHeight: 1.3 }}>
                Workflow not found
              </h1>
              <p className="mt-2 text-[13px] text-gray-400">
                The workflow with ID &ldquo;{workflowId}&rdquo; could not be found.
              </p>
              <Link
                href="/overview"
                className="mt-4 flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Overview
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const trigger = getTriggerSummary(workflow.graph);
  const signals = getSignals(workflow.graph);
  const optimizationItems = useMemo(() => getOptimizationItems(signals), [signals.hasBranching, signals.hasExternalCalls]);
  const visibleOptimizations = optimizationItems.filter((o) => !resolvedOptimizations.has(o.id));

  const cardsPerPage = 2;
  const totalPages = Math.max(1, Math.ceil(visibleOptimizations.length / cardsPerPage));
  const canPrev = carouselPage > 0;
  const canNext = carouselPage < totalPages - 1;
  const visibleCards = visibleOptimizations.slice(carouselPage * cardsPerPage, carouselPage * cardsPerPage + cardsPerPage);

  const detailGraph = useMemo(() => buildDetailGraph(workflow), [workflow]);
  const hasBranches = detailGraph.branches && detailGraph.branches.length > 0 && detailGraph.branches[0].nodes.length > 0;

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <SidebarTools workflows={[workflow]} selectedTool={selectedTool} onSelectTool={setSelectedTool} />
      <div className="ml-[80px] px-8 py-6">
        <div className="max-w-[1360px] mx-auto">
          <Link
            href="/overview"
            className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors mb-5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to dashboard
          </Link>

          <div className="flex items-start justify-between mb-1">
            <div>
              <h1 className="text-gray-900 tracking-tight" style={{ fontSize: "20px", lineHeight: 1.3 }}>
                {workflow.name}
              </h1>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[12px] text-gray-400">
                  Updated {new Date(workflow.updatedAt).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[13px] text-gray-600">{trigger.label}</span>
                <span className={`text-[10px] px-1.5 py-[2px] rounded border ${toolColors[workflow.provider] ?? toolColors.n8n}`}>
                  {workflow.provider}
                </span>
              </div>
            </div>
            <span className={`text-[11px] px-2.5 py-1 rounded-full border ${statusConfig[workflow.active ? "active" : "inactive"].bg} ${statusConfig[workflow.active ? "active" : "inactive"].text} ${statusConfig[workflow.active ? "active" : "inactive"].border}`}>
              {statusConfig[workflow.active ? "active" : "inactive"].label}
            </span>
          </div>

          <div className="space-y-7 mt-8">
            {/* 1. Optimization Opportunities (carousel) */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3.5 rounded-full bg-red-400" />
                  <span className="text-[11px] tracking-[0.08em] uppercase text-gray-400">
                    Optimization Opportunities
                  </span>
                </div>
                <div className="flex-1 h-px bg-gray-100" />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCarouselPage((p) => Math.max(0, p - 1))}
                    className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-150 cursor-pointer"
                    style={{ border: "1px solid rgba(0,0,0,0.1)", opacity: canPrev ? 1 : 0.3 }}
                    disabled={!canPrev}
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCarouselPage((p) => Math.min(totalPages - 1, p + 1))}
                    className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-150 cursor-pointer"
                    style={{ border: "1px solid rgba(0,0,0,0.1)", opacity: canNext ? 1 : 0.3 }}
                    disabled={!canNext}
                  >
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
              {visibleOptimizations.length === 0 ? (
                <div
                  className="bg-white rounded-xl px-6 py-8 text-center text-[13px] text-gray-400"
                  style={{ border: "1px solid rgba(0,0,0,0.07)" }}
                >
                  No optimization opportunities.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {visibleCards.map((item) => (
                      <OptimizationCard
                        key={item.id}
                        item={item}
                        onHighlightNodes={handleHighlightNodes}
                        onMarkResolved={handleMarkResolved}
                        previewSectionRef={workflowPreviewRef}
                      />
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1.5 mt-4">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setCarouselPage(i)}
                          className="rounded-full transition-all duration-200 cursor-pointer"
                          style={{
                            width: i === carouselPage ? 16 : 6,
                            height: 6,
                            borderRadius: i === carouselPage ? 3 : "50%",
                            background: i === carouselPage ? "#f87171" : "#d1d5db",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* 2. Workflow Preview */}
            <div ref={workflowPreviewRef}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3.5 rounded-full bg-indigo-400" />
                  <span className="text-[11px] tracking-[0.08em] uppercase text-gray-400">
                    Workflow Preview
                  </span>
                </div>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div
                className="bg-white rounded-xl w-full"
                style={{ border: "1px solid rgba(0,0,0,0.07)" }}
              >
                <div className="overflow-x-auto w-full">
                  {hasBranches ? (
                    <WorkflowGraphPreview nodes={detailGraph.nodes} branches={detailGraph.branches} />
                  ) : (
                    <WorkflowGraphPreviewLinear nodes={detailGraph.nodes} />
                  )}
                </div>
              </div>
            </div>

            {/* 3. Intent (Draft) — collapsible */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3.5 rounded-full bg-amber-400" />
                  <span className="text-[11px] tracking-[0.08em] uppercase text-gray-400">
                    Intent (Draft)
                  </span>
                </div>
                <div className="flex-1 h-px bg-gray-100" />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(JSON.stringify(intent, null, 2));
                      } catch {}
                    }}
                    className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors cursor-default"
                  >
                    Export JSON
                  </button>
                  <button
                    className="text-[12px] text-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-50 transition-colors cursor-default"
                    style={{ border: "1px solid rgba(0,0,0,0.1)" }}
                  >
                    Edit
                  </button>
                </div>
              </div>
              <div
                className="bg-white rounded-xl overflow-hidden"
                style={{ border: "1px solid rgba(0,0,0,0.07)" }}
              >
                <div className="px-6 py-5">
                  <IntentField label="Summary" value={intent.summary} />
                  <div className="flex items-center gap-4 mt-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] tracking-[0.08em] uppercase text-amber-600">Category</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                        {intent.category}
                      </span>
                    </div>
                    <div className="h-3 w-px bg-gray-100" />
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {intent.tags.map((tag) => (
                        <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIntentExpanded((e) => !e)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 cursor-pointer transition-colors duration-150 hover:bg-gray-50"
                  style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}
                >
                  <span className="text-[11px] text-gray-400">
                    {intentExpanded ? "Hide details" : "Show details"}
                  </span>
                  <ChevronDown
                    className="w-3 h-3 text-gray-400 transition-transform duration-200"
                    style={{ transform: intentExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>
                <div
                  className="overflow-hidden transition-all duration-200"
                  style={{
                    maxHeight: intentExpanded ? 400 : 0,
                    opacity: intentExpanded ? 1 : 0,
                  }}
                >
                  <div className="px-6 pb-5 pt-3" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <IntentField label="Problem solved" value={intent.problemSolved} />
                      <IntentField label="Input" value={intent.input} />
                      <IntentField label="Processing" value={intent.processing} />
                      <IntentField label="Output" value={intent.output} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
