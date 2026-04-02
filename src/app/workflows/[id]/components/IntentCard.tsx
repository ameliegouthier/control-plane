import type { WorkflowIntent } from "@/lib/intent";

interface IntentCardProps {
  intent: WorkflowIntent;
}

export default function IntentCard({ intent }: IntentCardProps) {
  return (
    <div className="glass-card overflow-hidden">
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
              <span key={tag} className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Fields grid */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Problem solved", value: intent.problemSolved },
            { label: "Input",          value: intent.input          },
            { label: "Processing",     value: intent.processing     },
            { label: "Output",         value: intent.output         },
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
  );
}
