"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { type Workflow } from "../../workflow-helpers";
import { type WorkflowIntent, generateDraftIntent } from "@/lib/intent";
import { useProviderFilter } from "@/hooks/useProviderFilter";
import { ArrowLeftIcon, RiskScoreBadge } from "@/components/ui";
import type { StatusBadgeVariant } from "@/components/ui";
import type { WorkflowInsightData } from "@/lib/providers/types";
import type { Signal } from "@/lib/signals/types";
import type { EnrichedIssue } from "@/lib/enrichment";
import { SIGNAL_META, URGENT_LEVELS, OPTIM_LEVELS } from "@/lib/signals/signalMeta";
import { summarizeWorkflowActions } from "@/lib/action-engine/issueEngine";
import WorkflowHeader from "./components/WorkflowHeader";
import WorkflowPreviewCard from "./components/WorkflowPreviewCard";
import IntentCard from "./components/IntentCard";
import OptimizationList from "./components/OptimizationList";

export type WorkflowDetailClientProps = {
  workflow: Workflow | null;
  workflowId: string;
  signals?: Signal[];
  issuesEnriched?: EnrichedIssue[];
  dbInsights?: WorkflowInsightData[];
};

function FixThisFirst({ action, category, severity }: { action: string; category: string; severity: number }) {
  if (!action) return null;
  const borderLeft = category === "broken" ? "border-l-red-400" : category === "security" ? "border-l-orange-400" : "border-l-amber-400";
  return (
    <div className={`flex items-center justify-between px-5 py-4 bg-white border border-l-4 ${borderLeft} rounded-xl`}>
      <div className="flex flex-col gap-0.5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Fix this first</div>
        <div className="text-[14px] font-semibold text-gray-900">{action}</div>
      </div>
      <RiskScoreBadge score={severity} size="sm" />
    </div>
  );
}

export default function WorkflowDetailClient({
  workflow: workflowProp,
  workflowId,
  signals,
  issuesEnriched,
  dbInsights,
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

  const aiInsights = useMemo(
    () => (dbInsights ?? []).filter((i) => i.type === "security" || i.type === "broken"),
    [dbInsights],
  );

  const topAction = useMemo(() => {
    if (!issuesEnriched || issuesEnriched.length === 0) return null;
    return summarizeWorkflowActions(issuesEnriched);
  }, [issuesEnriched]);

  const formattedDate = new Date(workflow.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const n = urgentSignals.length;
  const riskLevel = n >= 2 ? "High ↑" : n === 1 ? "Med" : "Low";
  const riskVariant: StatusBadgeVariant = n >= 2 ? "error" : n === 1 ? "warning" : "success";

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <div className="ml-[80px] px-8 py-6">
        <div className="max-w-[1360px] mx-auto flex flex-col gap-4">

          <Link
            href="/overview"
            className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Back to dashboard
          </Link>

          {/* Zone 1 — Header + Fix This First */}
          <div className="flex flex-col gap-3">
            <WorkflowHeader
              workflow={workflow}
              formattedDate={formattedDate}
              urgentSignals={urgentSignals}
              riskLevel={riskLevel}
              riskVariant={riskVariant}
            />
            {topAction?.topRecommendedAction && (
              <FixThisFirst
                action={topAction.topRecommendedAction}
                category={topAction.topIssue?.category ?? "optimization"}
                severity={topAction.topSeverity}
              />
            )}
          </div>

          {/* Zone 2 — Understand the workflow */}
          <div className="grid grid-cols-2 gap-4 items-start">
            <WorkflowPreviewCard workflow={workflow} />
            <IntentCard intent={intent} />
          </div>

          {/* Zone 3 — Issues */}
          {(aiInsights.length > 0 || optimizationItems.length > 0) && (
            <div className="grid grid-cols-2 gap-4 items-start">
              {aiInsights.length > 0 && (
                <div className={`bg-white rounded-xl border border-gray-100 overflow-hidden${optimizationItems.length === 0 ? " col-span-2" : ""}`}>
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                    <span className="w-[3px] h-3.5 rounded-sm bg-red-400 flex-shrink-0" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-gray-900">
                      AI Insights · {aiInsights.length}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-3">
                    {aiInsights.map((item) => (
                      <div
                        key={item.id}
                        className="pl-3"
                        style={{
                          borderLeft: `2px solid ${
                            item.severity === "high"
                              ? "#ef4444"
                              : item.severity === "medium"
                                ? "#f97316"
                                : "#9ca3af"
                          }`,
                        }}
                      >
                        <div className="text-[12px] font-medium text-gray-900">{item.title}</div>
                        {item.description && (
                          <div className="text-[11px] text-gray-400 mt-0.5">{item.description}</div>
                        )}
                        {item.fix && (
                          <div className="text-[11px] text-gray-400 mt-0.5">→ Fix: {item.fix}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {optimizationItems.length > 0 && (
                <div className={`bg-white rounded-xl border border-gray-100 overflow-hidden${aiInsights.length === 0 ? " col-span-2" : ""}`}>
                  <OptimizationList
                    optimizationItems={optimizationItems}
                    resolvedOptimizations={resolvedOptimizations}
                    onMarkResolved={handleMarkResolved}
                  />
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
