"use client";

import Link from "next/link";
import type { EnrichedIssue } from "@/lib/enrichment";

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
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function OptimizationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const iconClass = isUrgent ? "text-red-500" : "text-amber-500";

  return (
    <Link
      href={`/workflows/${workflow.id}`}
      className="flex items-start gap-3 rounded-lg border border-transparent p-4 transition hover:bg-white/60"
    >
      <div className={`shrink-0 ${iconClass}`}>
        {isUrgent ? <UrgentIcon /> : <OptimizationIcon />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-neutral-800">{title}</div>
        <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{description}</p>
      </div>
      <div className="shrink-0 text-neutral-400">
        <ChevronRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

function SectionBlock({
  title,
  count,
  items,
  variant,
  emptyMessage,
}: {
  title: string;
  count: number;
  items: ActionItem[];
  variant: "urgent" | "optimization";
  emptyMessage: string;
}) {
  const maxItems = variant === "urgent" ? MAX_URGENT_ITEMS : MAX_OPTIMIZATION_ITEMS;
  const displayItems = items.slice(0, maxItems);
  const isUrgent = variant === "urgent";
  const borderClass = isUrgent
    ? "border-red-100 bg-red-50/20"
    : "border-amber-100 bg-amber-50/20";
  const countClass = isUrgent ? "text-red-600" : "text-amber-600";

  if (items.length === 0) {
    return (
      <div className={`rounded-lg border px-5 py-5 ${borderClass}`}>
        <div className="flex items-center gap-2">
          {isUrgent && <div className="h-4 w-px bg-red-300" />}
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
            {title}
          </h3>
          <span className={`text-xs font-semibold ${countClass}`}>{count}</span>
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-neutral-200 bg-white/60 px-4 py-8 text-center">
          <p className="text-sm text-neutral-500">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${borderClass}`}>
      <div className="flex items-center gap-2 border-b border-neutral-200/60 px-5 py-3">
        {isUrgent && <div className="h-4 w-px bg-red-400" />}
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
          {title}
        </h3>
        <span className={`text-xs font-semibold ${countClass}`}>{items.length}</span>
      </div>
      <ul className="divide-y divide-neutral-200/60">
        {displayItems.map(({ workflow, topIssue }) => (
          <li key={workflow.id}>
            <ActionRow workflow={workflow} topIssue={topIssue} variant={variant} />
          </li>
        ))}
      </ul>
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
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-px bg-red-400" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
          Action Center
        </h2>
      </div>

      {!hasAny ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-6 py-10">
          <p className="text-center text-sm font-medium text-neutral-600">
            No critical actions right now
          </p>
          <p className="mt-1 text-center text-xs text-neutral-500">
            All workflows are in good shape.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionBlock
            title="Urgent"
            count={urgentItems.length}
            items={urgentItems}
            variant="urgent"
            emptyMessage="Nothing urgent right now."
          />
          <SectionBlock
            title="Optimization"
            count={optimizationItems.length}
            items={optimizationItems}
            variant="optimization"
            emptyMessage="No optimization items right now."
          />
        </div>
      )}
    </section>
  );
}
