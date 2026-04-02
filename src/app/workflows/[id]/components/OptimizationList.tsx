import type { WorkflowInsightData } from "@/lib/providers/types";

interface OptimizationListProps {
  optimizationItems: WorkflowInsightData[];
  resolvedOptimizations: Set<string>;
  onMarkResolved: (id: string) => void;
}

export default function OptimizationList({
  optimizationItems,
  resolvedOptimizations,
  onMarkResolved,
}: OptimizationListProps) {
  const visible = optimizationItems.filter((i) => !resolvedOptimizations.has(i.id));
  if (visible.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
        <span className="w-[3px] h-3.5 rounded-sm bg-amber-400 flex-shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-900">
          Optimization · {visible.length}
        </span>
      </div>
      <div className="px-4 py-3 flex flex-col gap-3">
        {visible.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-medium text-amber-800">{item.title}</div>
              <div className="text-[11px] text-amber-600 mt-0.5">{item.fix ?? item.description}</div>
            </div>
            <button
              type="button"
              onClick={() => onMarkResolved(item.id)}
              className="text-[11px] font-medium px-3 py-1.5 rounded-md border border-amber-200 bg-white text-amber-600 hover:bg-amber-50 transition-colors shrink-0 cursor-pointer"
            >
              Mark resolved
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
