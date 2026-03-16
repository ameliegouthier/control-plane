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

interface NodeCardProps {
  themeKey: string;
  label: string;
  service?: string;
}

export function NodeCard({ themeKey, label, service }: NodeCardProps) {
  const t = nodeThemes[themeKey] ?? nodeThemes.action;

  return (
    <div style={{ width: 220, height: 80 }}>
      <div
        className="relative w-full h-full rounded-xl flex flex-col justify-center"
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
          className="text-[12px] truncate"
          style={{ color: t.text, lineHeight: "16px" }}
        >
          {label}
        </div>
        {service && (
          <span
            className="text-[10px] text-gray-400 truncate mt-0.5"
            style={{ lineHeight: "14px" }}
          >
            {service}
          </span>
        )}
      </div>
    </div>
  );
}
