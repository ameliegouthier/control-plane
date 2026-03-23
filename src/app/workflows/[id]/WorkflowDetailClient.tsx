"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import {
  type Workflow,
  getTriggerSummary,
  buildMiniMap,
} from "../../workflow-helpers";
import type { MiniMapNode } from "../../workflow-helpers";
import {
  type WorkflowIntent,
  generateDraftIntent,
} from "@/lib/intent";
import { useProviderFilter } from "@/hooks/useProviderFilter";
import { WorkflowGraphReactFlow } from "@/components/workflows/WorkflowGraphReactFlow";
import { ChevronDownIcon, ArrowLeftIcon, GitBranchIcon } from "@/components/ui";
import type { WorkflowInsightData } from "@/lib/providers/types";
import type { Signal } from "@/lib/signals/types";
import type { EnrichedIssue } from "@/lib/enrichment";
import { SIGNAL_META, URGENT_LEVELS, OPTIM_LEVELS } from "@/lib/signals/signalMeta";

export type WorkflowDetailClientProps = {
  workflow: Workflow | null;
  workflowId: string;
  signals?: Signal[];
  issuesEnriched?: EnrichedIssue[];
};


// ─── Optimization (carousel) ─────────────────────────────────────────────────

function OptimizationCard({
  item,
  onMarkResolved,
}: {
  item: WorkflowInsightData;
  onMarkResolved: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-col justify-between shrink-0 rounded-xl"
      style={{
        minWidth: 220,
        maxWidth: 240,
        padding: "16px 18px",
        background: "rgba(250,238,218,0.6)",
        border: "0.5px solid #EF9F27",
      }}
    >
      <div>
        <div
          className="text-[12px] font-medium mb-2"
          style={{ color: "#633806", lineHeight: 1.4 }}
        >
          {item.title}
        </div>
        {item.fix && (
          <div
            className="text-[11px] line-clamp-2"
            style={{ color: "#854F0B", lineHeight: 1.5 }}
          >
            {item.fix}
          </div>
        )}
      </div>
      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={() => onMarkResolved(item.id)}
          className="text-[11px] px-2.5 py-1 rounded-md transition-opacity hover:opacity-70 cursor-pointer"
          style={{
            color: "#854F0B",
            border: "1px solid #EF9F27",
            background: "rgba(255,255,255,0.5)",
          }}
        >
          Mark as resolved
        </button>
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
  /** Provider-specific node type (e.g. "ai-local-agent:RunLocalAIAgent"). */
  rawType: string;
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

/** Format normalized service name for display (e.g. "google-sheets" → "Google Sheets"). */
function formatServiceDisplay(service: string): string {
  return service
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function toDetailNode(
  node: MiniMapNode,
  index: number,
  chainLength: number,
  isMainChain: boolean
): DetailNode {
  const serviceLabel =
    typeof node.service === "string" && node.service.trim()
      ? formatServiceDisplay(node.service.trim())
      : getServiceLabel(node.type);
  return {
    id: `${node.name}-${index}-${isMainChain ? "m" : "b"}`,
    label: node.name,
    type: getDetailNodeTypeByPosition(node.type, index, chainLength, isMainChain),
    rawType: node.type,
    service: serviceLabel,
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

// ─── DotGrid, Connector, GraphNode, GraphLegend, BranchLabel, SplitColumn, WorkflowGraphPreview, WorkflowGraphPreviewLinear, IntentField, statusConfig, toolColors ───
// (abbreviated: same as in page.tsx - full content would be duplicated; we keep page as client that re-exports from Client file)

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

function GraphNode({ node }: { node: DetailNode }) {
  const t = nodeTheme[node.type];
  return (
    <div className="flex flex-col items-center shrink-0 min-w-[120px]" style={{ width: 180 }}>
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

function isAgentNode(node: DetailNode): boolean {
  const t = node.rawType.toLowerCase();
  return t.includes("ai-local-agent");
}

function ConditionLayout({
  node,
  trueBranch,
  falseBranch,
}: {
  node: DetailNode;
  trueBranch: DetailNode[];
  falseBranch: DetailNode[];
}) {
  return (
    <div className="flex flex-col items-center shrink-0 relative">
      <GraphNode node={node} />
      <div className="flex justify-between w-full mt-6 gap-6">
        {trueBranch.length > 0 && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1 mb-1">
              <BranchLabel text="True" color="green" />
            </div>
            <div className="flex items-center gap-0">
              {trueBranch.map((bn, index) => (
                <div key={bn.id} className="flex items-center">
                  {index > 0 && <Connector />}
                  <GraphNode node={bn} />
                </div>
              ))}
            </div>
          </div>
        )}
        {falseBranch.length > 0 && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1 mb-1">
              <BranchLabel text="False" color="red" />
            </div>
            <div className="flex items-center gap-0">
              {falseBranch.map((bn, index) => (
                <div key={bn.id} className="flex items-center">
                  {index > 0 && <Connector />}
                  <GraphNode node={bn} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentLayout({
  node,
  tools,
}: {
  node: DetailNode;
  tools: DetailNode[];
}) {
  return (
    <div className="flex flex-col items-center shrink-0">
      <GraphNode node={node} />
      {tools.length > 0 && (
        <div className="flex border-l border-gray-200 pl-4 mt-4">
          <div className="flex flex-col gap-4">
            {tools.map((tool) => (
              <div key={tool.id} className="flex items-center">
                <div className="w-4 h-px bg-gray-200 mr-2" />
                <GraphNode node={tool} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkflowGraphPreview({
  nodes,
  branches,
}: {
  nodes: DetailNode[];
  branches?: { fromNodeLabel: string; nodes: DetailNode[] }[];
}) {
  const hasBranches = branches && branches.length > 0 && branches[0].nodes.length > 0;
  const branchIndex = nodes.findIndex((n) => n.type === "condition");
  const falsePathNodes = hasBranches ? branches![0].nodes : [];

  if (nodes.length === 0) {
    return (
      <p className="py-12 text-center text-[13px] text-gray-400">
        No nodes to display.
      </p>
    );
  }

  const mainNodes =
    branchIndex >= 0 ? nodes.slice(0, branchIndex + 1) : nodes;
  const trueBranchNodes =
    branchIndex >= 0 ? nodes.slice(branchIndex + 1) : [];

  return (
    <div className="relative rounded-xl w-full">
      <DotGrid />
      <div className="relative w-full">
        <div className="flex items-center gap-0 py-6 px-2">
          {mainNodes.map((node, index) => {
            const isConditionNode = node.type === "condition" && hasBranches && index === branchIndex;
            return (
              <div key={node.id} className="flex items-center">
                {index > 0 && <Connector />}
                {isConditionNode ? (
                  <ConditionLayout
                    node={node}
                    trueBranch={trueBranchNodes}
                    falseBranch={falsePathNodes}
                  />
                ) : (
                  <GraphNode node={node} />
                )}
              </div>
            );
          })}
        </div>
        <div className={`flex items-center mt-2 px-2 w-full ${hasBranches ? "justify-between" : "justify-end"}`}>
          {hasBranches && (
            <div className="flex items-center gap-1.5 text-gray-400">
              <GitBranchIcon className="w-3 h-3" />
              <span className="text-[10px]">Conditional branching</span>
            </div>
          )}
          <GraphLegend />
        </div>
      </div>
    </div>
  );
}

function WorkflowGraphPreviewLinear({ nodes }: { nodes: DetailNode[] }) {
  if (nodes.length === 0) {
    return (
      <p className="py-12 text-center text-[13px] text-gray-400">
        No nodes to display.
      </p>
    );
  }

  const segments: { node: DetailNode; tools: DetailNode[] }[] = [];
  for (let i = 0; i < nodes.length; ) {
    const current = nodes[i];
    if (isAgentNode(current)) {
      let j = i + 1;
      while (
        j < nodes.length &&
        !isAgentNode(nodes[j]) &&
        nodes[j].type !== "condition" &&
        nodes[j].type !== "trigger"
      ) {
        j++;
      }
      const following = nodes.slice(i + 1, j);

      // Treat all but the last following node as tools.
      // The last node in the run remains in the main horizontal flow (e.g. Output).
      if (following.length >= 2) {
        const tools = following.slice(0, following.length - 1);
        const nextIndex = j - 1;
        segments.push({ node: current, tools });
        i = nextIndex;
      } else {
        segments.push({ node: current, tools: [] });
        i += 1;
      }
    } else {
      segments.push({ node: current, tools: [] });
      i += 1;
    }
  }

  return (
    <div className="relative rounded-xl w-full">
      <DotGrid />
      <div className="relative w-full">
        <div className="flex items-center gap-0 py-6 px-2">
          {segments.map((segment, index) => (
            <div key={segment.node.id} className="flex items-center">
              {index > 0 && <Connector />}
              {isAgentNode(segment.node) ? (
                <AgentLayout node={segment.node} tools={segment.tools} />
              ) : (
                <GraphNode node={segment.node} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-2 px-2 w-full">
          <GraphLegend />
        </div>
      </div>
    </div>
  );
}

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

// ─── Main client component ────────────────────────────────────────────────────

export default function WorkflowDetailClient({ workflow: workflowProp, workflowId, signals, issuesEnriched }: WorkflowDetailClientProps) {
  const workflow = workflowProp;
  const { mergeWorkflows } = useProviderFilter({
    mode: "workflow",
    workflowProvider: workflow?.provider,
  });

  useEffect(() => {
    if (workflow) {
      mergeWorkflows([workflow]);
    }
  }, [workflow, mergeWorkflows]);

  const draftIntent = useMemo(() => (workflow ? generateDraftIntent(workflow) : null), [workflow]);
  const [intentOverrides, setIntentOverrides] = useState<Record<string, WorkflowIntent>>({});
  const intent = useMemo(
    () => (draftIntent ? intentOverrides[workflowId] ?? draftIntent : null),
    [draftIntent, intentOverrides, workflowId]
  );

  const [resolvedOptimizations, setResolvedOptimizations] = useState<Set<string>>(new Set());
  const handleMarkResolved = useCallback((id: string) => {
    setResolvedOptimizations((prev) => new Set(prev).add(id));
  }, []);

  if (!workflow || !intent) {
    return (
      <div className="bg-[#fafafa] min-h-screen">
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
                <ArrowLeftIcon className="w-3.5 h-3.5" />
                Back to Overview
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const urgentSignals = useMemo(
    () =>
      (signals ?? [])
        .filter((s) => URGENT_LEVELS.has(SIGNAL_META[s.type].level))
        .filter((s) => !resolvedOptimizations.has(s.type)),
    [signals, resolvedOptimizations],
  );

  const optimizationItems: WorkflowInsightData[] = useMemo(() => {
    if (signals && signals.length > 0) {
      return signals
        .filter((s) => OPTIM_LEVELS.has(SIGNAL_META[s.type].level))
        .map((sig) => {
          const meta = SIGNAL_META[sig.type];
          return {
            id: sig.type,
            type: "optimization",
            severity: "medium",
            title: meta.label,
            description: null,
            fix: meta.recommendedAction,
          } satisfies WorkflowInsightData;
        });
    }
    return (workflow.insights ?? []).filter((i) => i.type === "optimization");
  }, [signals, workflow.insights]);

  const formattedDate = new Date(workflow.updatedAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const riskLevel =
    urgentSignals.length >= 2 ? "High ↑" : urgentSignals.length === 1 ? "Med" : "Low";
  const riskStyle =
    urgentSignals.length >= 2
      ? "bg-orange-50 text-orange-700 border-orange-100"
      : urgentSignals.length === 1
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : "bg-emerald-50 text-emerald-700 border-emerald-100";

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <div className="ml-[80px] px-8 py-6">
        <div className="max-w-[1360px] mx-auto">
          <Link
            href="/overview"
            className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors mb-5"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Back to dashboard
          </Link>

          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex flex-col gap-1">
              <h1 className="text-[20px] font-medium text-gray-900">{workflow.name}</h1>
              <div className="flex items-center gap-2 text-[12px] text-gray-400">
                <span>Updated {formattedDate}</span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span>
                  {urgentSignals.length} issue{urgentSignals.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {workflow.provider}
              </span>
              <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${riskStyle}`}>
                Risk: {riskLevel}
              </span>
              <span
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                  workflow.active
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    : "bg-gray-100 text-gray-500 border border-gray-200"
                }`}
              >
                {workflow.active ? "Active" : "Idle"}
              </span>
            </div>
          </div>

          {/* Urgent signals */}
          {urgentSignals.length > 0 && (
            <div className="mb-4">
              {urgentSignals.map((signal) => (
                <div
                  key={signal.type}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-red-50 border-t border-r border-b border-red-100 mb-2"
                  style={{ borderLeft: "2px solid #f87171" }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <div>
                      <div className="text-[12px] font-medium text-red-800">
                        {SIGNAL_META[signal.type].label}
                      </div>
                      <div className="text-[11px] text-red-600 mt-0.5">
                        {SIGNAL_META[signal.type].recommendedAction}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMarkResolved(signal.type)}
                    className="text-[11px] font-medium px-3 py-1.5 rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-colors shrink-0 cursor-pointer"
                  >
                    Fix this →
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 2-column layout */}
          <div className="grid grid-cols-2 gap-3 items-start">

            {/* Left column: Preview only */}
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                <span className="w-[3px] h-3.5 rounded-sm bg-indigo-400 flex-shrink-0" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-900">
                  Workflow preview
                </span>
              </div>
              <div className="p-5 min-h-[200px] overflow-x-auto">
                <WorkflowGraphReactFlow workflow={workflow} />
              </div>
            </div>

            {/* Right column: Intent + Optimization */}
            <div className="flex flex-col gap-3">

            {/* Intent */}
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-[3px] h-3.5 rounded-sm bg-indigo-400 flex-shrink-0" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-900">
                    Intent
                  </span>
                </div>
                <button
                  type="button"
                  className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                >
                  Edit
                </button>
              </div>
              <div className="p-4 flex flex-col gap-4">
                {/* Summary + tags */}
                <div className="pb-4 border-b border-gray-50">
                  <p className="text-[13px] text-gray-600 leading-relaxed">{intent.summary}</p>
                  <div className="flex gap-1.5 flex-wrap mt-2.5">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                      {intent.category}
                    </span>
                    {intent.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Fields grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Problem solved", value: intent.problemSolved },
                    { label: "Input", value: intent.input },
                    { label: "Processing", value: intent.processing },
                    { label: "Output", value: intent.output },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-300">
                        {label}
                      </span>
                      <span className="text-[12px] text-gray-500 leading-relaxed">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Optimization */}
            {optimizationItems.filter((i) => !resolvedOptimizations.has(i.id)).length > 0 && (
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                  <span className="w-[3px] h-3.5 rounded-sm bg-amber-400 flex-shrink-0" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-900">
                    Optimization · {optimizationItems.filter((i) => !resolvedOptimizations.has(i.id)).length}
                  </span>
                </div>
                <div className="px-4 py-3 flex flex-col gap-3">
                  {optimizationItems
                    .filter((item) => !resolvedOptimizations.has(item.id))
                    .map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[12px] font-medium text-amber-800">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-amber-600 mt-0.5">
                            {item.fix ?? item.description}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleMarkResolved(item.id)}
                          className="text-[11px] font-medium px-3 py-1.5 rounded-md border border-amber-200 bg-white text-amber-600 hover:bg-amber-50 transition-colors shrink-0 cursor-pointer"
                        >
                          Mark resolved
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            </div>{/* end right column */}

          </div>
        </div>
      </div>
    </div>
  );
}
