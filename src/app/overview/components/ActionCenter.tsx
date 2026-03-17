"use client";

import { saveDashboardScroll } from "@/lib/dashboard-scroll";
import type { EnrichedIssue } from "@/lib/enrichment";
import { SectionHeader, AlertTriangleIcon, OptimizationIcon, ActionListItem } from "@/components/ui";

export interface ActionItem {
  workflow: {
    id: string;
    name: string;
    tool: string;
    severity: number;
    bucket?: "urgent" | "optimization";
    issuesEnriched?: EnrichedIssue[];
    issues?: { type: string }[];
  };
  topIssue?: EnrichedIssue;
}

const MAX_URGENT_ITEMS = 20;
const MAX_OPTIMIZATION_ITEMS = 5;

function formatIssueType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}


function SectionBlock({
  title,
  items,
  variant,
  emptyMessage,
}: {
  title: string;
  items: ActionItem[];
  variant: "urgent" | "optimization";
  emptyMessage: string;
}) {
  const maxItems = variant === "urgent" ? MAX_URGENT_ITEMS : MAX_OPTIMIZATION_ITEMS;
  const displayItems = items.slice(0, maxItems);
  const isUrgent = variant === "urgent";
  const dotColor = isUrgent ? "bg-red-500" : "bg-amber-500";

  return (
    <div>
      {/* Sub-header */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className={`w-[6px] h-[6px] rounded-full ${dotColor}`} />
        <span className="text-[11px] text-gray-900">{title}</span>
        <span className="text-[11px] text-gray-400">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div
          className="bg-white rounded-lg px-4 py-8 text-center"
          style={{ border: '1px solid rgba(0,0,0,0.06)' }}
        >
          <p className="text-[12px] text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {displayItems.map(({ workflow, topIssue }) => {
            const impact = topIssue?.copy?.impact ?? "This workflow needs attention.";
            const issueTypeLabel = topIssue ? formatIssueType(topIssue.type) : "Issue";
            const rowTitle = isUrgent ? (topIssue?.type === "broken" ? "Broken workflow" : issueTypeLabel) : issueTypeLabel;
            const rowDescription = `${workflow.name} — ${impact}`;
            const rowIcon = isUrgent
              ? <AlertTriangleIcon className="w-3.5 h-3.5" />
              : <OptimizationIcon className="w-3.5 h-3.5" />;
            return (
              <ActionListItem
                key={workflow.id}
                href={`/workflows/${workflow.id}`}
                icon={rowIcon}
                title={rowTitle}
                description={rowDescription}
                variant={variant}
                onClick={saveDashboardScroll}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ActionCenterProps {
  urgentItems: ActionItem[];
  optimizationItems: ActionItem[];
}

export default function ActionCenter({
  urgentItems,
  optimizationItems,
}: ActionCenterProps) {
  const hasAny = urgentItems.length > 0 || optimizationItems.length > 0;

  return (
    <section>
      <SectionHeader title="Action Center" accent="bg-red-400" />

      {!hasAny ? (
        <div
          className="bg-white rounded-xl px-6 py-10 text-center"
          style={{ border: '1px solid rgba(0,0,0,0.07)' }}
        >
          <p className="text-[13px] text-gray-500">No critical actions right now</p>
          <p className="mt-1 text-[11px] text-gray-400">All workflows are in good shape.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <SectionBlock
            title="Urgent"
            items={urgentItems}
            variant="urgent"
            emptyMessage="Nothing urgent right now."
          />
          <SectionBlock
            title="Optimization"
            items={optimizationItems}
            variant="optimization"
            emptyMessage="No optimization items right now."
          />
        </div>
      )}
    </section>
  );
}
