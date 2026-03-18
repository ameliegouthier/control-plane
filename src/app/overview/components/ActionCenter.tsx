"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { saveDashboardScroll } from "@/lib/dashboard-scroll";
import type { EnrichedIssue } from "@/lib/enrichment";
import { SectionHeader, AlertTriangleIcon, OptimizationIcon, ActionListItem, ExternalLinkIcon } from "@/components/ui";
import type { SignalType } from "@/lib/signals/types";
import type { SignalLevel } from "@/lib/signals/signalMeta";

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

export interface SignalGroup {
  signalType: SignalType;
  label: string;
  level: SignalLevel;
  recommendedAction: string;
  workflows: { id: string; name: string }[];
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

const VARIANT_CONFIG: Record<"urgent" | "optimization", { iconBg: string; iconText: string; iconBorder: string }> = {
  urgent: { iconBg: "bg-red-50", iconText: "text-red-600", iconBorder: "border-red-100" },
  optimization: { iconBg: "bg-amber-50", iconText: "text-amber-700", iconBorder: "border-amber-100" },
};

function ExpandableGroupRow({
  icon,
  title,
  description,
  variant,
  isExpanded,
  onToggle,
  noBorder = false,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  variant: "urgent" | "optimization";
  isExpanded: boolean;
  onToggle: () => void;
  noBorder?: boolean;
}) {
  const { iconBg, iconText, iconBorder } = VARIANT_CONFIG[variant];
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3.5 py-3 bg-card rounded-lg hover:shadow-sm transition-all duration-150 cursor-pointer text-left"
      style={noBorder ? undefined : { border: "1px solid rgba(0,0,0,0.06)" }}
    >
      <div className={`w-7 h-7 rounded-md ${iconBg} ${iconText} flex items-center justify-center shrink-0 border ${iconBorder}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground truncate">{description}</div>
      </div>
      <svg
        className={`w-3.5 h-3.5 text-muted-foreground/30 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

function SignalGroupBlock({
  title,
  groups,
  variant,
  emptyMessage,
}: {
  title: string;
  groups: SignalGroup[];
  variant: "urgent" | "optimization";
  emptyMessage: string;
}) {
  const maxItems = variant === "urgent" ? MAX_URGENT_ITEMS : MAX_OPTIMIZATION_ITEMS;
  const displayGroups = groups.slice(0, maxItems);
  const isUrgent = variant === "urgent";
  const dotColor = isUrgent ? "bg-red-500" : "bg-amber-500";
  const icon = isUrgent
    ? <AlertTriangleIcon className="w-3.5 h-3.5" />
    : <OptimizationIcon className="w-3.5 h-3.5" />;

  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  const toggleExpand = (signalType: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(signalType)) {
        next.delete(signalType);
      } else {
        next.add(signalType);
      }
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <span className={`w-[6px] h-[6px] rounded-full ${dotColor}`} />
        <span className="text-[11px] text-gray-900">{title}</span>
        <span className="text-[11px] text-gray-400">{groups.length}</span>
      </div>

      {groups.length === 0 ? (
        <div
          className="bg-white rounded-lg px-4 py-8 text-center"
          style={{ border: '1px solid rgba(0,0,0,0.06)' }}
        >
          <p className="text-[12px] text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {displayGroups.map((group) => {
            const isMulti = group.workflows.length > 1;
            const rowTitle = isMulti
              ? `${group.label} · ${group.workflows.length} workflows`
              : group.label;
            const isExpanded = expandedTypes.has(group.signalType);

            if (isMulti) {
              return (
                <div
                  key={group.signalType}
                  className="bg-card rounded-lg overflow-hidden"
                  style={{ border: "1px solid rgba(0,0,0,0.06)" }}
                >
                  <ExpandableGroupRow
                    icon={icon}
                    title={rowTitle}
                    description={group.recommendedAction}
                    variant={variant}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(group.signalType)}
                    noBorder
                  />
                  {isExpanded && (
                    <div style={{ borderTop: "0.5px solid rgba(0,0,0,0.08)" }}>
                      {group.workflows.map((wf, idx) => (
                        <div key={wf.id}>
                          {idx > 0 && (
                            <div style={{ height: "0.5px", background: "rgba(0,0,0,0.06)", marginLeft: 24 }} />
                          )}
                          <Link
                            href={`/workflows/${wf.id}`}
                            onClick={saveDashboardScroll}
                            className="flex items-center gap-2 py-2 pr-3.5 hover:bg-accent/40 transition-colors"
                            style={{ paddingLeft: 24 }}
                          >
                            <span className="flex-1 text-[12px] text-muted-foreground truncate">{wf.name}</span>
                            <ExternalLinkIcon className="w-3 h-3 shrink-0 text-muted-foreground/40" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <ActionListItem
                key={group.signalType}
                href={`/workflows/${group.workflows[0].id}`}
                icon={icon}
                title={rowTitle}
                description={`${group.workflows[0].name} — ${group.recommendedAction}`}
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
  urgentSignalGroups?: SignalGroup[];
  optimizationSignalGroups?: SignalGroup[];
}

export default function ActionCenter({
  urgentItems,
  optimizationItems,
  urgentSignalGroups,
  optimizationSignalGroups,
}: ActionCenterProps) {
  const hasSignals = (urgentSignalGroups !== undefined || optimizationSignalGroups !== undefined);
  const urgentCount = hasSignals
    ? (urgentSignalGroups?.length ?? 0)
    : urgentItems.length;
  const optimCount = hasSignals
    ? (optimizationSignalGroups?.length ?? 0)
    : optimizationItems.length;

  const hasAny = urgentCount > 0 || optimCount > 0;

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
          {hasSignals ? (
            <SignalGroupBlock
              title="Urgent"
              groups={urgentSignalGroups ?? []}
              variant="urgent"
              emptyMessage="Nothing urgent right now."
            />
          ) : (
            <SectionBlock
              title="Urgent"
              items={urgentItems}
              variant="urgent"
              emptyMessage="Nothing urgent right now."
            />
          )}
          {hasSignals ? (
            <SignalGroupBlock
              title="Optimization"
              groups={optimizationSignalGroups ?? []}
              variant="optimization"
              emptyMessage="No optimization items right now."
            />
          ) : (
            <SectionBlock
              title="Optimization"
              items={optimizationItems}
              variant="optimization"
              emptyMessage="No optimization items right now."
            />
          )}
        </div>
      )}
    </section>
  );
}
