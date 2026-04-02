"use client";

import type { EnrichedIssue } from "@/lib/enrichment";
import { SectionHeader, InsightCard } from "@/components/ui";
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
              <InsightCard
                key={workflow.id}
                label={label}
                count={1}
                description={ISSUE_DESCRIPTIONS[topIssue?.type ?? ""] ?? fallback}
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
            <InsightCard
              key={group.signalType}
              label={group.label}
              count={group.workflows.length}
              description={ISSUE_DESCRIPTIONS[group.signalType] ?? group.recommendedAction}
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
