"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { type Workflow } from "../../workflow-helpers";
import { type WorkflowIntent, generateDraftIntent } from "@/lib/intent";
import { useProviderFilter } from "@/hooks/useProviderFilter";
import { ArrowLeftIcon } from "@/components/ui";
import type { StatusBadgeVariant } from "@/components/ui";
import type { WorkflowInsightData } from "@/lib/providers/types";
import type { Signal } from "@/lib/signals/types";
import type { EnrichedIssue } from "@/lib/enrichment";
import { SIGNAL_META, URGENT_LEVELS, OPTIM_LEVELS } from "@/lib/signals/signalMeta";
import WorkflowHeader from "./components/WorkflowHeader";
import UrgentSignalsBanner from "./components/UrgentSignalsBanner";
import WorkflowPreviewCard from "./components/WorkflowPreviewCard";
import IntentCard from "./components/IntentCard";
import OptimizationList from "./components/OptimizationList";

export type WorkflowDetailClientProps = {
  workflow: Workflow | null;
  workflowId: string;
  signals?: Signal[];
  issuesEnriched?: EnrichedIssue[];
};

export default function WorkflowDetailClient({
  workflow: workflowProp,
  workflowId,
  signals,
}: WorkflowDetailClientProps) {
  const workflow = workflowProp;
  const { mergeWorkflows } = useProviderFilter({
    mode: "workflow",
    workflowProvider: workflow?.provider,
  });

  useEffect(() => {
    if (workflow) mergeWorkflows([workflow]);
  }, [workflow, mergeWorkflows]);

  const draftIntent = useMemo(
    () => (workflow ? generateDraftIntent(workflow) : null),
    [workflow],
  );
  const [intentOverrides] = useState<Record<string, WorkflowIntent>>({});
  const intent = useMemo(
    () => (draftIntent ? intentOverrides[workflowId] ?? draftIntent : null),
    [draftIntent, intentOverrides, workflowId],
  );

  const [resolvedOptimizations, setResolvedOptimizations] = useState<Set<string>>(new Set());
  const handleMarkResolved = useCallback((id: string) => {
    setResolvedOptimizations((prev) => new Set(prev).add(id));
  }, []);

  if (!workflow || !intent) {
    return (
      <div className="bg-[#fafafa] min-h-screen ml-[80px] px-8 py-6">
        <div className="max-w-[1360px] mx-auto flex flex-col items-center justify-center py-24">
          <h1 className="text-gray-900" style={{ fontSize: "20px", lineHeight: 1.3 }}>Workflow not found</h1>
          <p className="mt-2 text-[13px] text-gray-400">
            The workflow with ID &ldquo;{workflowId}&rdquo; could not be found.
          </p>
          <Link href="/overview" className="mt-4 flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Back to Overview
          </Link>
        </div>
      </div>
    );
  }

  const urgentSignals = useMemo(
    () =>
      (signals ?? [])
        .filter((s) => URGENT_LEVELS.has(SIGNAL_META[s.type].level))
        .filter((s) => !resolvedOptimizations.has(s.type)),
    [signals, resolvedOptimizations],
  );

  const optimizationItems: WorkflowInsightData[] = useMemo(() => {
    if (signals && signals.length > 0) {
      return signals
        .filter((s) => OPTIM_LEVELS.has(SIGNAL_META[s.type].level))
        .map((sig) => {
          const meta = SIGNAL_META[sig.type];
          return {
            id: sig.type,
            type: "optimization",
            severity: "medium",
            title: meta.label,
            description: null,
            fix: meta.recommendedAction,
          } satisfies WorkflowInsightData;
        });
    }
    return (workflow.insights ?? []).filter((i) => i.type === "optimization");
  }, [signals, workflow.insights]);

  const formattedDate = new Date(workflow.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const n = urgentSignals.length;
  const riskLevel = n >= 2 ? "High ↑" : n === 1 ? "Med" : "Low";
  const riskVariant: StatusBadgeVariant = n >= 2 ? "error" : n === 1 ? "warning" : "success";

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <div className="ml-[80px] px-8 py-6">
        <div className="max-w-[1360px] mx-auto">
          <Link
            href="/overview"
            className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors mb-5"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Back to dashboard
          </Link>

          <WorkflowHeader
            workflow={workflow}
            formattedDate={formattedDate}
            urgentSignals={urgentSignals}
            riskLevel={riskLevel}
            riskVariant={riskVariant}
          />

          <UrgentSignalsBanner
            urgentSignals={urgentSignals}
            onMarkResolved={handleMarkResolved}
          />

          <div className="grid grid-cols-2 gap-3 items-start">
            <WorkflowPreviewCard workflow={workflow} />
            <div className="flex flex-col gap-3">
              <IntentCard intent={intent} />
              <OptimizationList
                optimizationItems={optimizationItems}
                resolvedOptimizations={resolvedOptimizations}
                onMarkResolved={handleMarkResolved}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
