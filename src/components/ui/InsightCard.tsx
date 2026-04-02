import Link from "next/link";
import { saveDashboardScroll } from "@/lib/dashboard-scroll";

export interface InsightCardProps {
  label: string;
  count?: number;
  description: string;
  workflows: { id: string; name: string }[];
  variant: "urgent" | "optimization";
  onBeforeNavigate?: () => void;
}

export function InsightCard({
  label,
  count,
  description,
  workflows,
  variant,
  onBeforeNavigate,
}: InsightCardProps) {
  const isUrgent = variant === "urgent";
  const topWorkflows = workflows.slice(0, 2);
  const remaining = workflows.length - 2;
  const topNames = topWorkflows.map((wf) => wf.name).join(", ");

  return (
    <div
      className="glass-card px-4 py-3"
      style={{
        borderLeft: isUrgent ? "2px solid #f87171" : "2px solid #fbbf24",
      }}
    >
      <div className="text-[13px] font-medium text-foreground">
        {label}
        {(count ?? 0) > 1 && (
          <span className="ml-1.5 text-[11px] text-muted-foreground font-normal">
            · {count}
          </span>
        )}
      </div>
      <p className="text-[12px] text-gray-500 leading-relaxed mt-1.5 mb-3">{description}</p>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
        <div className="max-w-[65%]">
          <span className="text-[12px] text-gray-500 font-medium">
            {topNames}
            {remaining > 0 && ` +${remaining} more`}
          </span>
        </div>
        <Link
          href={`/workflows/${workflows[0].id}`}
          onClick={onBeforeNavigate ?? saveDashboardScroll}
          className={`text-[11px] font-medium px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
            isUrgent
              ? "border-red-200 text-red-600 bg-white hover:bg-red-50"
              : "border-amber-200 text-amber-600 bg-white hover:bg-amber-50"
          }`}
        >
          {isUrgent ? "Fix this →" : "Review →"}
        </Link>
      </div>
    </div>
  );
}
