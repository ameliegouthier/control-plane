"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AutomationProvider,
  Workflow,
  WorkflowGraph,
} from "@/app/workflow-helpers";
import {
  type WorkflowWithFullEnrichment,
  type HealthStatus,
  getEnrichmentForWorkflow,
  detectDuplicates,
  addIssuesToEnrichedWorkflows,
  type RawWorkflow,
} from "@/lib/enrichment";
import { getDashboardScroll, clearDashboardScroll } from "@/lib/dashboard-scroll";
import type { WorkflowLike } from "@/lib/provider-filter";
import { SectionHeader, Badge } from "@/components/ui";
import { useProviderFilter } from "@/hooks/useProviderFilter";
import KpiCards, { computeSystemHealth } from "./components/KpiCards";
import SystemMap from "./components/SystemMap";
import WorkflowList from "./components/WorkflowList";
import ActionCenter, { type ActionItem, type SignalGroup } from "./components/ActionCenter";
import { detectSignals } from "@/lib/signals/detectSignals";
import type { Signal, SignalType, WorkflowWithSignals } from "@/lib/signals/types";
import { SIGNAL_META, URGENT_LEVELS, OPTIM_LEVELS } from "@/lib/signals/signalMeta";

type EnrichedWorkflow = WorkflowWithFullEnrichment & WorkflowLike & {
  tool: AutomationProvider;
  graph?: WorkflowGraph;
};

function ResyncAllButton({ integrationIds }: { integrationIds: string[] }) {
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    if (integrationIds.length === 0) return;
    setLoading(true);

    try {
      await Promise.all(
        integrationIds.map((id) =>
          fetch(`/api/integrations/${id}/sync`, { method: "POST" })
        )
      );
    } catch {
      // Swallow errors; page reload will reflect eventual state.
    } finally {
      setLoading(false);
      window.location.reload();
    }
  };

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={loading || integrationIds.length === 0}
      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60"
    >
      {loading ? "Resyncing…" : "Resync workflows"}
    </button>
  );
}

export type OverviewClientProps = {
  rawWorkflows: RawWorkflow[];
  workflows: Workflow[];
  /** Server-rendered source of truth for whether demo mode is enabled. */
  initialDemoMode: boolean;
  /** Integration IDs to show Resync/Disconnect for (from DB integrations, not derived from workflows). */
  integrationIdsForSync?: string[];
  /** AI-generated insights from WorkflowInsight DB table. */
  workflowInsights?: { workflowId: string; type: string; severity: string; title: string; description: string | null; fix: string | null }[];
};

export type StatusFilter = "all" | "ok" | "broken" | "inactive";

export default function OverviewClient({
  rawWorkflows,
  workflows,
  initialDemoMode,
  integrationIdsForSync = [],
  workflowInsights = [],
}: OverviewClientProps): React.JSX.Element {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { setWorkflows, filterByProviders } = useProviderFilter();

  useEffect(() => {
    setWorkflows(workflows);
  }, [workflows, setWorkflows]);

  const enrichedBase = useMemo(
    () =>
      rawWorkflows.map((w) => {
        const workflow = workflows.find((wf) => wf.id === w.id);
        return {
          ...w,
          enrichment: getEnrichmentForWorkflow(w),
          tool: (workflow?.provider ?? "n8n") as AutomationProvider,
          graph: workflow?.graph,
        };
      }),
    [rawWorkflows, workflows],
  );

  const duplicateMapFull = useMemo(
    () => detectDuplicates(enrichedBase).map,
    [enrichedBase],
  );

  const enriched: EnrichedWorkflow[] = useMemo(
    () =>
      addIssuesToEnrichedWorkflows(enrichedBase, duplicateMapFull).map((wf) => ({
        ...wf,
        tool: (enrichedBase.find((e) => e.id === wf.id)?.tool ?? "n8n") as AutomationProvider,
        provider: (enrichedBase.find((e) => e.id === wf.id)?.tool ?? "n8n") as string,
      })),
    [enrichedBase, duplicateMapFull],
  );

  const providerFiltered = useMemo(
    () => filterByProviders(enriched),
    [enriched, filterByProviders],
  );

  const urgentActions: ActionItem[] = useMemo(() => {
    const list = providerFiltered.filter((wf) =>
      wf.issuesEnriched.some(
        (i) => i.category === "broken" || i.category === "security",
      ),
    );
    const sorted = [...list].sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      return (a.name ?? "").localeCompare(b.name ?? "", undefined, {
        sensitivity: "base",
      });
    });
    return sorted.map((workflow) => {
      const topIssue =
        workflow.issuesEnriched
          .filter(
            (i) => i.category === "broken" || i.category === "security",
          )
          .sort((a, b) => b.severity - a.severity)[0] ??
        workflow.issuesEnriched[0];
      return {
        workflow: {
          id: workflow.id,
          name: workflow.name,
          tool: workflow.tool,
          severity: workflow.severity,
          bucket: "urgent" as const,
          issuesEnriched: workflow.issuesEnriched,
          issues: workflow.issues,
        },
        topIssue,
      };
    });
  }, [providerFiltered]);

  const optimizationActions: ActionItem[] = useMemo(() => {
    const list = providerFiltered.filter(
      (wf) => wf.hasOptimization && wf.enrichment.health !== "broken",
    );
    const sorted = [...list].sort((a, b) => b.severity - a.severity);
    const actions = sorted.map((workflow) => {
      const topIssue =
        workflow.issuesEnriched
          .filter((i) => i.category === "optimization")
          .sort((a, b) => b.severity - a.severity)[0] ??
        workflow.issuesEnriched[0];
      return {
        workflow: {
          id: workflow.id,
          name: workflow.name,
          tool: workflow.tool,
          severity: workflow.severity,
          bucket: "optimization" as const,
          issuesEnriched: workflow.issuesEnriched,
          issues: workflow.issues,
        },
        topIssue,
      };
    });
    if (process.env.NODE_ENV === "development") {
      console.log("OPTIMIZATION_DEBUG: optimization actions", {
        workflowIds: actions.map((a) => a.workflow.id),
        actions,
      });
    }
    return actions;
  }, [providerFiltered]);

  const filtered = useMemo(() => {
    let result: EnrichedWorkflow[] = providerFiltered;

    if (statusFilter === "ok") {
      result = result.filter((wf) => wf.active && wf.enrichment.health !== "broken");
    } else if (statusFilter === "broken") {
      result = result.filter((wf) => wf.enrichment.health === "broken");
    } else if (statusFilter === "inactive") {
      result = result.filter((wf) => !wf.active);
    }

    return result;
  }, [providerFiltered, statusFilter]);

  const totalWorkflows = filtered.length;
  const activeWorkflows = filtered.filter((w) => w.active).length;
  const idleCount = filtered.filter((w) => !w.active).length;
  const brokenCount = filtered.filter((w) => w.enrichment.health === "broken").length;

  const connectionCount = useMemo(
    () => new Set(filtered.map((w) => w.tool)).size,
    [filtered],
  );

  const connectionNames = useMemo(
    () => Array.from(new Set(filtered.map((w) => w.tool))).join(" · ") || "None",
    [filtered],
  );

  const systemHealth = useMemo(
    () => computeSystemHealth(filtered.map((w) => w.enrichment.health as HealthStatus)),
    [filtered],
  );

  const executionFailures = filtered.filter(
    (w) => w.lastExecutionStatus === "error",
  ).length;

  /** Server-supplied integration IDs so Resync/Disconnect run for every connected provider (e.g. Make with no workflows yet). */
  const resyncIntegrationIds = integrationIdsForSync;
  const deleteIntegrationIds = integrationIdsForSync;

  const workflowsWithSignals = useMemo(() => {
    const withGraphs = enriched.filter((wf) => {
      const nodes = (wf as { graph?: { nodes?: unknown[] } }).graph?.nodes;
      return Array.isArray(nodes) && nodes.length > 0;
    });
    const prepared = withGraphs.map((wf) => ({
      ...wf,
      signals: [] as Signal[],
    })) as unknown as WorkflowWithSignals[];
    try {
      return detectSignals(prepared);
    } catch {
      return prepared;
    }
  }, [enriched]);

  const signalGroupsAll: SignalGroup[] = useMemo(() => {
    const map = new Map<SignalType, SignalGroup>();
    for (const wf of workflowsWithSignals) {
      for (const signal of wf.signals) {
        const meta = SIGNAL_META[signal.type];
        if (!meta) continue;
        const existing = map.get(signal.type);
        if (existing) {
          existing.workflows.push({ id: wf.id, name: wf.name });
        } else {
          map.set(signal.type, {
            signalType: signal.type,
            label: meta.label,
            level: meta.level,
            recommendedAction: meta.recommendedAction,
            workflows: [{ id: wf.id, name: wf.name }],
          });
        }
      }
    }
    return Array.from(map.values());
  }, [workflowsWithSignals]);

  const urgentSignalGroups = useMemo(
    () => signalGroupsAll.filter((g) => URGENT_LEVELS.has(g.level)),
    [signalGroupsAll],
  );

  const optimizationSignalGroups = useMemo(
    () => signalGroupsAll.filter((g) => OPTIM_LEVELS.has(g.level)),
    [signalGroupsAll],
  );

  const fullWorkflowsForTable = useMemo(() => {
    const ids = new Set(filtered.map((wf) => wf.id));
    return workflows.filter((w) => ids.has(w.id));
  }, [filtered, workflows]);

  const { map: duplicateMap } = useMemo(
    () => detectDuplicates(filtered),
    [filtered],
  );

  const router = useRouter();

  useEffect(() => {
    const savedScroll = getDashboardScroll();
    if (savedScroll != null) {
      window.scrollTo(0, savedScroll);
      clearDashboardScroll();
    }
  }, []);

  const allSystemsOk = systemHealth >= 80 && executionFailures === 0;

  const okCount = providerFiltered.filter((w) => w.active && w.enrichment.health !== "broken").length;
  const brokenCountAll = providerFiltered.filter((w) => w.enrichment.health === "broken").length;
  const inactiveCountAll = providerFiltered.filter((w) => !w.active).length;

  const handleSetDemoMode = useCallback(
    async (enabled: boolean) => {
      try {
        await fetch("/api/demo-mode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
        // Do not keep a separate client-side source of truth.
        // After the POST succeeds, rely on the refreshed server state.
        router.refresh();
      } catch {
        // ignore network errors in UI-only toggle
      }
    },
    [router],
  );

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <div className="ml-[80px] px-8 py-6">
        <div className="max-w-[1360px] mx-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-7">
            <Badge variant={allSystemsOk ? "success" : "warning"} className="px-3 py-1.5 text-[13px]">
              {allSystemsOk ? "All systems operational" : "Needs attention"}
            </Badge>

            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Disconnect integrations"
                  title="Disconnect integrations"
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors disabled:opacity-60"
                  disabled={deleteIntegrationIds.length === 0}
                  onClick={async () => {
                    if (deleteIntegrationIds.length === 0) return;
                    try {
                      await Promise.all(
                        deleteIntegrationIds.map((id) =>
                          fetch(`/api/integrations/${id}`, {
                            method: "DELETE",
                          }),
                        ),
                      );
                      router.refresh();
                    } catch {
                      // Ignore errors for this testing-only control.
                    }
                  }}
                >
                  <svg
                    className="w-[13px] h-[13px]"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3.5 4.75H12.5"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M6.25 2.5H9.75"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M4.25 4.75L4.58333 11.5833C4.62979 12.5094 5.39438 13.25 6.32097 13.25H9.67903C10.6056 13.25 11.3702 12.5094 11.4167 11.5833L11.75 4.75"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M6.5 7V10.25"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9.5 7V10.25"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>

                {resyncIntegrationIds.length > 0 && (
                  <ResyncAllButton integrationIds={resyncIntegrationIds} />
                )}

                {/* Data source segmented control */}
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-1 py-1 text-[11px] font-medium shadow-sm">
                  <div className="flex w-fit rounded-full bg-gray-100 px-1 py-0.5 text-[#858585]">
                    <button
                      type="button"
                      onClick={() => handleSetDemoMode(true)}
                      className={`w-full rounded-full px-1.5 py-1 text-[10px] transition ${
                        initialDemoMode
                          ? "bg-gray-900 text-white shadow-xs"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Demo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetDemoMode(false)}
                      className={`w-full rounded-full px-2.5 py-1 text-[10px] transition ${
                        !initialDemoMode
                          ? "bg-gray-900 text-white shadow-xs"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Live
                    </button>
                  </div>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                Last synced 2m ago
              </span>
            </div>
          </div>

          {/* Dashboard Sections */}
          <div className="space-y-7">
            {/* System Health Banner */}
            {urgentSignalGroups.length > 0 && (() => {
              const totalIssues = urgentSignalGroups.reduce((sum, g) => sum + g.workflows.length, 0);
              const topGroups = [...urgentSignalGroups]
                .sort((a, b) => b.workflows.length - a.workflows.length)
                .slice(0, 3);
              const subtitle = topGroups
                .map((g) => `${g.workflows.length} ${g.label.toLowerCase()}${g.workflows.length > 1 ? "s" : ""}`)
                .join(" · ");
              return (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "#FCEBEB", border: "1px solid #F09595" }}
                >
                  <span
                    className="shrink-0 rounded-full"
                    style={{ width: 6, height: 6, background: "#DC2626" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium" style={{ color: "#791F1F" }}>
                      {totalIssues} urgent issue{totalIssues > 1 ? "s" : ""} across your system
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: "#A32D2D" }}>
                      {subtitle}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => document.getElementById("action-center")?.scrollIntoView({ behavior: "smooth" })}
                    className="text-[12px] font-medium shrink-0 cursor-pointer transition-opacity hover:opacity-70"
                    style={{ color: "#791F1F" }}
                  >
                    Fix this first →
                  </button>
                </div>
              );
            })()}

            {/* Section 1: System Overview */}
            <section>
            { /* <SectionHeader title="System Overview" accent="bg-gray-300" /> */ }
              <KpiCards
                totalWorkflows={totalWorkflows}
                connections={connectionCount}
                systemHealth={systemHealth}
                executionFailures={executionFailures}
                activeWorkflows={activeWorkflows}
                idleCount={idleCount}
                brokenCount={brokenCount}
                connectionNames={connectionNames}
              />
            </section>

            {/* Section 2: System Map */}
            <SystemMap workflows={filtered} />

            {/* Section 3: Action Center */}
            <div id="action-center">
              <ActionCenter
                urgentItems={urgentActions}
                optimizationItems={optimizationActions}
                urgentSignalGroups={urgentSignalGroups}
                optimizationSignalGroups={optimizationSignalGroups}
              />
            </div>

            {/* Section 4: All Workflows */}
            <section>
              <SectionHeader title="All Workflows" accent="bg-gray-300" />
              <WorkflowList
                workflows={filtered}
                fullWorkflows={fullWorkflowsForTable}
                duplicateMap={duplicateMap}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                statusCounts={{
                  total: providerFiltered.length,
                  ok: okCount,
                  broken: brokenCountAll,
                  inactive: inactiveCountAll,
                }}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
