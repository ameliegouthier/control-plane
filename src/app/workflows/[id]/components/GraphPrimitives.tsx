import { buildMiniMap } from "../../../workflow-helpers";
import type { MiniMapNode, Workflow } from "../../../workflow-helpers";
import { GitBranchIcon } from "@/components/ui";
import type { WorkflowInsightData } from "@/lib/providers/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DetailNodeType = "trigger" | "action" | "condition" | "destination";

export interface DetailNode {
  id: string;
  label: string;
  type: DetailNodeType;
  rawType: string;
  service?: string;
  databaseId?: string;
  channelId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const nodeTheme: Record<
  DetailNodeType,
  { bg: string; border: string; text: string; pillBg: string; pillText: string; label: string; dotBg: string }
> = {
  trigger:     { bg: "#f0f5ff", border: "#c7d9f9", text: "#2554c7", pillBg: "#e0ecff", pillText: "#2554c7", label: "Trigger",   dotBg: "#4d7cee" },
  condition:   { bg: "#fffcf0", border: "#f5e1a0", text: "#9c5e10", pillBg: "#fef3cd", pillText: "#9c5e10", label: "Condition",  dotBg: "#e8a830" },
  destination: { bg: "#f0faf5", border: "#a8e6cf", text: "#1a7a52", pillBg: "#d4f5e4", pillText: "#1a7a52", label: "Output",     dotBg: "#34b87a" },
  action:      { bg: "#f8f9fb", border: "#dde1e8", text: "#4a5568", pillBg: "#edf0f4", pillText: "#4a5568", label: "Action",     dotBg: "#8e99a8" },
};

export const statusConfig: Record<string, { label: string; text: string; bg: string; border: string }> = {
  active:   { label: "Active", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  inactive: { label: "Paused", text: "text-gray-500",    bg: "bg-gray-50",    border: "border-gray-200"    },
};

export const toolColors: Record<string, string> = {
  n8n:      "bg-orange-50 text-orange-600 border-orange-100",
  make:     "bg-violet-50 text-violet-600 border-violet-100",
  zapier:   "bg-amber-50  text-amber-600  border-amber-100",
  airtable: "bg-blue-50   text-blue-600   border-blue-100",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDetailNodeTypeByPosition(
  rawType: string,
  index: number,
  chainLength: number,
  isMainChain: boolean,
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
  if (t.includes("webhook"))     return "Webhook";
  if (t.includes("if ") || t === "if") return "IF";
  if (t.includes("switch"))      return "Switch";
  if (t.includes("hubspot"))     return "HubSpot";
  if (t.includes("gmail"))       return "Gmail";
  if (t.includes("slack"))       return "Slack";
  if (t.includes("httprequest")) return "HTTP Request";
  if (t.includes("schedule"))    return "Schedule";
  if (t.includes("manual"))      return "Manual";
  const raw = type.includes(".") ? type.split(".").pop()! : type;
  const words = raw.replace(/([a-z])([A-Z])/g, "$1 $2").split(/[\s_-]+/);
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

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
  isMainChain: boolean,
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
    ...(node.channelId  != null && { channelId:  node.channelId  }),
  };
}

export function buildDetailGraph(workflow: Workflow): {
  nodes: DetailNode[];
  branches?: { fromNodeLabel: string; nodes: DetailNode[] }[];
} {
  const { mainPath, branches, conditionIndex } = buildMiniMap(workflow.graph);
  if (mainPath.length === 0) return { nodes: [] };
  const nodes: DetailNode[] = mainPath.map((n, i) => toDetailNode(n, i, mainPath.length, true));
  if (conditionIndex != null && conditionIndex >= 0 && conditionIndex < nodes.length) {
    nodes[conditionIndex] = { ...nodes[conditionIndex], type: "condition" };
  }
  if (branches.length === 0) return { nodes };
  const conditionLabel =
    mainPath[conditionIndex ?? mainPath.length - 1]?.name ?? mainPath[mainPath.length - 1].name;
  const falsePathNodes = branches[0];
  const falsePath: DetailNode[] = falsePathNodes.map((n, i) =>
    toDetailNode(n, i, falsePathNodes.length, false),
  );
  return { nodes, branches: [{ fromNodeLabel: conditionLabel, nodes: falsePath }] };
}

export function isAgentNode(node: DetailNode): boolean {
  return node.rawType.toLowerCase().includes("ai-local-agent");
}

// ─── Primitive components ─────────────────────────────────────────────────────

export function DotGrid() {
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

export function Connector({ length = 48 }: { length?: number }) {
  return (
    <div className="flex items-center justify-center shrink-0 self-center mr-2" style={{ width: length, height: 20 }}>
      <svg className="block" width={length} height={20} viewBox={`0 0 ${length} 20`} fill="none">
        <line x1="0" y1="10" x2={length - 6} y2="10" stroke="#dde1e8" strokeWidth="1.5" strokeDasharray="4 3" />
        <polygon points={`${length - 7},6 ${length},10 ${length - 7},14`} fill="#c5ccd6" />
      </svg>
    </div>
  );
}

export function GraphNode({ node }: { node: DetailNode }) {
  const t = nodeTheme[node.type];
  return (
    <div className="flex flex-col items-center shrink-0 min-w-[120px]" style={{ width: 180 }}>
      <div
        className="relative w-full rounded-xl transition-all duration-200 hover:shadow-sm"
        style={{ background: t.bg, border: `1.5px solid ${t.border}`, padding: "10px 14px" }}
      >
        <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
          <div className="rounded-full shrink-0" style={{ width: 5, height: 5, background: t.dotBg }} />
          <span className="text-[9px] tracking-[0.06em] uppercase truncate" style={{ color: t.pillText, opacity: 0.8 }}>
            {t.label}
          </span>
        </div>
        <div className="text-[12px]" style={{ color: t.text, lineHeight: "16px" }}>{node.label}</div>
      </div>
      {node.service && (
        <span className="text-[10px] text-gray-400 mt-1.5" style={{ lineHeight: "14px" }}>{node.service}</span>
      )}
      {(node.databaseId != null || node.channelId != null) && (
        <div className="text-[10px] text-gray-500 mt-1 space-y-0.5" style={{ lineHeight: "14px" }}>
          {node.databaseId != null && <div>Database: {node.databaseId}</div>}
          {node.channelId  != null && <div>Channel: {node.channelId}</div>}
        </div>
      )}
    </div>
  );
}

export function GraphLegend() {
  const items = [
    { label: "Trigger",   color: "#4d7cee" },
    { label: "Action",    color: "#8e99a8" },
    { label: "Condition", color: "#e8a830" },
    { label: "Output",    color: "#34b87a" },
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

export function BranchLabel({ text, color }: { text: string; color: "green" | "red" }) {
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

export function ConditionLayout({
  node, trueBranch, falseBranch,
}: {
  node: DetailNode; trueBranch: DetailNode[]; falseBranch: DetailNode[];
}) {
  return (
    <div className="flex flex-col items-center shrink-0 relative">
      <GraphNode node={node} />
      <div className="flex justify-between w-full mt-6 gap-6">
        {trueBranch.length > 0 && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1 mb-1"><BranchLabel text="True" color="green" /></div>
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
            <div className="flex items-center gap-1 mb-1"><BranchLabel text="False" color="red" /></div>
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

export function AgentLayout({ node, tools }: { node: DetailNode; tools: DetailNode[] }) {
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

export function WorkflowGraphPreview({
  nodes, branches,
}: {
  nodes: DetailNode[];
  branches?: { fromNodeLabel: string; nodes: DetailNode[] }[];
}) {
  const hasBranches = branches && branches.length > 0 && branches[0].nodes.length > 0;
  const branchIndex = nodes.findIndex((n) => n.type === "condition");
  const falsePathNodes = hasBranches ? branches![0].nodes : [];

  if (nodes.length === 0) {
    return <p className="py-12 text-center text-[13px] text-gray-400">No nodes to display.</p>;
  }

  const mainNodes      = branchIndex >= 0 ? nodes.slice(0, branchIndex + 1) : nodes;
  const trueBranchNodes = branchIndex >= 0 ? nodes.slice(branchIndex + 1)   : [];

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
                  <ConditionLayout node={node} trueBranch={trueBranchNodes} falseBranch={falsePathNodes} />
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

export function WorkflowGraphPreviewLinear({ nodes }: { nodes: DetailNode[] }) {
  if (nodes.length === 0) {
    return <p className="py-12 text-center text-[13px] text-gray-400">No nodes to display.</p>;
  }

  const segments: { node: DetailNode; tools: DetailNode[] }[] = [];
  for (let i = 0; i < nodes.length; ) {
    const current = nodes[i];
    if (isAgentNode(current)) {
      let j = i + 1;
      while (j < nodes.length && !isAgentNode(nodes[j]) && nodes[j].type !== "condition" && nodes[j].type !== "trigger") {
        j++;
      }
      const following = nodes.slice(i + 1, j);
      if (following.length >= 2) {
        segments.push({ node: current, tools: following.slice(0, following.length - 1) });
        i = j - 1;
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
        <div className="flex justify-end mt-2 px-2 w-full"><GraphLegend /></div>
      </div>
    </div>
  );
}

export function IntentField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] tracking-[0.08em] uppercase text-amber-600 mb-1">{label}</div>
      <div className="text-[13px] text-gray-700" style={{ lineHeight: 1.6 }}>{value}</div>
    </div>
  );
}

export function OptimizationCard({
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
        <div className="text-[12px] font-medium mb-2" style={{ color: "#633806", lineHeight: 1.4 }}>
          {item.title}
        </div>
        {item.fix && (
          <div className="text-[11px] line-clamp-2" style={{ color: "#854F0B", lineHeight: 1.5 }}>
            {item.fix}
          </div>
        )}
      </div>
      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={() => onMarkResolved(item.id)}
          className="text-[11px] px-2.5 py-1 rounded-md transition-opacity hover:opacity-70 cursor-pointer"
          style={{ color: "#854F0B", border: "1px solid #EF9F27", background: "rgba(255,255,255,0.5)" }}
        >
          Mark as resolved
        </button>
      </div>
    </div>
  );
}
