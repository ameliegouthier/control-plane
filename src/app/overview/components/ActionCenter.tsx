"use client";

import Link from "next/link";
import { saveDashboardScroll } from "@/lib/dashboard-scroll";
import type { EnrichedIssue } from "@/lib/enrichment";
import { SectionHeader } from "@/components/ui";
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

const ISSUE_DESCRIPTIONS: Record<string, string> = {
  public_webhook:
    "Ces webhooks sont accessibles publiquement — n'importe qui peut déclencher ces workflows. Ajoute une clé d'API ou un secret.",
  missing_authentication:
    "Ces workflows appellent des services externes sans credentials configurés. Ils peuvent échouer silencieusement en production.",
  no_trigger:
    "Ces workflows n'ont pas de trigger configuré — ils ne s'exécutent jamais automatiquement.",
  external_webhook:
    "La source de ce webhook externe n'est pas vérifiée. Ajoute une validation de signature.",
  duplicate_workflow:
    "Ces workflows font la même chose. Consolide-les en un seul workflow réutilisable.",
  orphan_service:
    "Ces workflows connectent des services qui ne sont plus utilisés. Nettoie les intégrations mortes.",
  too_many_integrations:
    "Ces workflows connectent trop de services en série. Considère de les découper en workflows plus simples.",
};

function formatIssueType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function IssueCard({
  label,
  count,
  issueType,
  fallbackDescription,
  workflows,
  variant,
}: {
  label: string;
  count: number;
  issueType: string;
  fallbackDescription: string;
  workflows: { id: string; name: string }[];
  variant: "urgent" | "optimization";
}) {
  const isUrgent = variant === "urgent";
  const description = ISSUE_DESCRIPTIONS[issueType] ?? fallbackDescription;
  const topWorkflows = workflows.slice(0, 2);
  const remaining = workflows.length - 2;
  const topNames = topWorkflows.map((wf) => wf.name).join(", ");

  return (
    <div
      className="bg-card rounded-lg px-4 py-3"
      style={{
        borderTop: "1px solid rgba(0,0,0,0.06)",
        borderRight: "1px solid rgba(0,0,0,0.06)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        borderLeft: isUrgent ? "2px solid #f87171" : "2px solid #fbbf24",
      }}
    >
      <div className="text-[13px] font-medium text-foreground">
        {label}
        {count > 1 && (
          <span className="ml-1.5 text-[11px] text-muted-foreground font-normal">
            · {count}
          </span>
        )}
      </div>
      <p className="text-[12px] text-gray-500 leading-relaxed mt-1.5 mb-3">
        {description}
      </p>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
        <div className="max-w-[65%]">
          <span className="text-[12px] text-gray-500 font-medium">
            {topNames}
            {remaining > 0 && ` +${remaining} more`}
          </span>
        </div>
        <Link
          href={`/workflows/${workflows[0].id}`}
          onClick={saveDashboardScroll}
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
          style={{ border: "1px solid rgba(0,0,0,0.06)" }}
        >
          <p className="text-[12px] text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayItems.map(({ workflow, topIssue }) => {
            const label = topIssue
              ? isUrgent && topIssue.type === "broken"
                ? "Broken workflow"
                : formatIssueType(topIssue.type)
              : "Issue";
            const fallback = topIssue?.copy?.impact ?? "This workflow needs attention.";
            return (
              <IssueCard
                key={workflow.id}
                label={label}
                count={1}
                issueType={topIssue?.type ?? ""}
                fallbackDescription={fallback}
                workflows={[{ id: workflow.id, name: workflow.name }]}
                variant={variant}
              />
            );
          })}
        </div>
      )}
    </div>
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
          style={{ border: "1px solid rgba(0,0,0,0.06)" }}
        >
          <p className="text-[12px] text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayGroups.map((group) => (
            <IssueCard
              key={group.signalType}
              label={group.label}
              count={group.workflows.length}
              issueType={group.signalType}
              fallbackDescription={group.recommendedAction}
              workflows={group.workflows}
              variant={variant}
            />
          ))}
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
  const hasSignals =
    urgentSignalGroups !== undefined || optimizationSignalGroups !== undefined;
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
          style={{ border: "1px solid rgba(0,0,0,0.07)" }}
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
