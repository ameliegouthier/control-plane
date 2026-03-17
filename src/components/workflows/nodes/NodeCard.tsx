/**
 * Shared card component used by all custom React Flow workflow nodes.
 * Replicates the exact card design from WorkflowDetailClient (GraphNode).
 */

interface NodeTheme {
  bg: string;
  border: string;
  text: string;
  pillText: string;
  label: string;
  dotBg: string;
}

export const nodeThemes: Record<string, NodeTheme> = {
  trigger:   { bg: "#f0f5ff", border: "#c7d9f9", text: "#2554c7", pillText: "#2554c7", label: "Trigger",   dotBg: "#4d7cee" },
  action:    { bg: "#f8f9fb", border: "#dde1e8", text: "#4a5568", pillText: "#4a5568", label: "Action",    dotBg: "#8e99a8" },
  agent:     { bg: "#f5f3ff", border: "#c4b5fd", text: "#5b21b6", pillText: "#5b21b6", label: "Agent",     dotBg: "#7c3aed" },
  output:    { bg: "#f0faf5", border: "#a8e6cf", text: "#1a7a52", pillText: "#1a7a52", label: "Output",    dotBg: "#34b87a" },
  condition: { bg: "#fffcf0", border: "#f5e1a0", text: "#9c5e10", pillText: "#9c5e10", label: "Condition", dotBg: "#e8a830" },
  tool:      { bg: "#f1f5f9", border: "#cbd5e1", text: "#475569", pillText: "#475569", label: "Tool",      dotBg: "#64748b" },
};

function formatOperation(op: string): string {
  return op
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

interface NodeCardProps {
  themeKey: string;
  label: string;
  service?: string;
  operation?: string;
  aiSummary?: string | null;
}

export function NodeCard({ themeKey, label, service, operation, aiSummary }: NodeCardProps) {
  const t = nodeThemes[themeKey] ?? nodeThemes.action;
  const serviceDisplay = service ?? label;
  const operationDisplay = operation ? formatOperation(operation) : null;
  const mainText = aiSummary?.trim().replace(/\.$/, "") ?? operationDisplay ?? label;

  return (
    <div style={{ width: 220 }}>
      <div
        className="relative w-full rounded-xl flex flex-col justify-center"
        style={{
          background: t.bg,
          border: `1.5px solid ${t.border}`,
          padding: "10px 14px",
        }}
      >
        <div className="flex items-center gap-1.5 mb-1 min-w-0">
          <div
            className="rounded-full shrink-0"
            style={{ width: 5, height: 5, background: t.dotBg }}
          />
          <span
            className="text-[9px] tracking-[0.06em] uppercase truncate"
            style={{ color: t.pillText, opacity: 0.8 }}
          >
            {t.label}
          </span>
        </div>
        <div
          className="text-[9px] uppercase truncate"
          style={{ color: t.text, opacity: 0.8, lineHeight: "14px", marginBottom: "6px" }}
        >
          {serviceDisplay}
        </div>
        <div
          style={{
            color: t.text,
            fontWeight: 500,
            fontSize: "11px",
            lineHeight: "15px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {mainText}
        </div>
      </div>
    </div>
  );
}
