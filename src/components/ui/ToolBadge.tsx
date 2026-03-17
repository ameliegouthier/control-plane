const TOOL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  n8n: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100" },
  zapier: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
  make: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-100" },
  airtable: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
};

export function ToolBadge({ tool }: { tool: string }) {
  const s = TOOL_STYLES[tool] ?? { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-100" };
  return (
    <span className={`text-[10px] px-1.5 py-[2px] rounded border ${s.bg} ${s.text} ${s.border}`}>
      {tool}
    </span>
  );
}
