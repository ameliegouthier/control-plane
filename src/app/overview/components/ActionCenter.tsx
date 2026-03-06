"use client";

import Link from "next/link";
import { saveDashboardScroll } from "@/lib/dashboard-scroll";
import type { EnrichedIssue } from "@/lib/enrichment";
import { SectionHeader } from "@/components/ui";

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

function UrgentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function OptimizationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ActionRow({
  workflow,
  topIssue,
  variant,
}: {
  workflow: ActionItem["workflow"];
  topIssue?: EnrichedIssue;
  variant: "urgent" | "optimization";
}) {
  const impact = topIssue?.copy?.impact ?? "This workflow needs attention.";
  const issueTypeLabel = topIssue ? formatIssueType(topIssue.type) : "Issue";
  const title = variant === "urgent" ? (topIssue?.type === "broken" ? "Broken workflow" : issueTypeLabel) : issueTypeLabel;
  const description = `${workflow.name} — ${impact}`;

  const isUrgent = variant === "urgent";
  const accentBg = isUrgent ? "bg-red-50" : "bg-amber-50";
  const accentText = isUrgent ? "text-red-600" : "text-amber-700";
  const accentBorder = isUrgent ? "border-red-100" : "border-amber-100";

  return (
    <Link
      href={`/workflows/${workflow.id}`}
      className="flex items-center gap-3 px-3.5 py-3 bg-white rounded-lg hover:bg-gray-50/60 transition-all duration-150 cursor-pointer group"
      style={{ border: '1px solid rgba(0,0,0,0.06)' }}
      onClick={saveDashboardScroll}
    >
      <div className={`w-7 h-7 rounded-md ${accentBg} ${accentText} flex items-center justify-center shrink-0 border ${accentBorder}`}>
        {isUrgent ? <UrgentIcon className="w-3.5 h-3.5" /> : <OptimizationIcon className="w-3.5 h-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-gray-900">{title}</div>
        <div className="text-[11px] text-gray-400 truncate">{description}</div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-gray-200 group-hover:text-gray-400 transition-colors shrink-0" />
    </Link>
  );
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
          {displayItems.map(({ workflow, topIssue }) => (
            <ActionRow key={workflow.id} workflow={workflow} topIssue={topIssue} variant={variant} />
          ))}
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
