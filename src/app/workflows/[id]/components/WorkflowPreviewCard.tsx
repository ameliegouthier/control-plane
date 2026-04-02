import type { Workflow } from "../../../workflow-helpers";
import { WorkflowGraphReactFlow } from "@/components/workflows/WorkflowGraphReactFlow";

interface WorkflowPreviewCardProps {
  workflow: Workflow;
}

export default function WorkflowPreviewCard({ workflow }: WorkflowPreviewCardProps) {
  return (
    <div className="glass-card overflow-hidden">
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
  );
}
