import type { Workflow } from "../../../workflow-helpers";
import type { Signal } from "@/lib/signals/types";
import { StatusBadge } from "@/components/ui";
import type { StatusBadgeVariant } from "@/components/ui";

interface WorkflowHeaderProps {
  workflow: Workflow;
  formattedDate: string;
  urgentSignals: Signal[];
  riskLevel: string;
  riskVariant: StatusBadgeVariant;
}

export default function WorkflowHeader({
  workflow,
  formattedDate,
  urgentSignals,
  riskLevel,
  riskVariant,
}: WorkflowHeaderProps) {
  return (
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
        <StatusBadge variant="blue">{workflow.provider}</StatusBadge>
        <StatusBadge variant={riskVariant}>Risk: {riskLevel}</StatusBadge>
        <StatusBadge variant={workflow.active ? "success" : "neutral"}>
          {workflow.active ? "Active" : "Idle"}
        </StatusBadge>
      </div>
    </div>
  );
}
