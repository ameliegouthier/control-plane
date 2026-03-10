"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConnectProviderModal from "../connect-provider-modal";
import type { AutomationProvider, Workflow } from "@/app/workflow-helpers";
import {
  type WorkflowWithFullEnrichment,
  type HealthStatus,
  getEnrichmentForWorkflow,
  detectDuplicates,
  addIssuesToEnrichedWorkflows,
  type RawWorkflow,
} from "@/lib/enrichment";
import { getDashboardScroll, clearDashboardScroll } from "@/lib/dashboard-scroll";
import { SectionHeader, Badge } from "@/components/ui";
import SidebarTools from "./components/SidebarTools";
import KpiCards, { computeSystemHealth } from "./components/KpiCards";
import SystemMap from "./components/SystemMap";
import WorkflowList from "./components/WorkflowList";
import ActionCenter, { type ActionItem } from "./components/ActionCenter";

type EnrichedWorkflow = WorkflowWithFullEnrichment & { tool: AutomationProvider };

export type OverviewClientProps = {
  rawWorkflows: RawWorkflow[];
  workflows: Workflow[];
  /** Server-rendered source of truth for whether demo mode is enabled. */
  initialDemoMode: boolean;
};

export type StatusFilter = "all" | "ok" | "broken" | "inactive";

export default function OverviewClient({
  rawWorkflows,
  workflows,
  initialDemoMode,
}: OverviewClientProps): React.JSX.Element {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);

  const enrichedBase = useMemo(
    () =>
      rawWorkflows.map((w) => {
        const workflow = workflows.find((wf) => wf.id === w.id);
        return {
          ...w,
          enrichment: getEnrichmentForWorkflow(w),
          tool: (workflow?.provider ?? "n8n") as AutomationProvider,
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
      })),
    [enrichedBase, duplicateMapFull],
  );

  const urgentActions: ActionItem[] = useMemo(() => {
    const list = enriched.filter((wf) => wf.enrichment.health === "broken");
    const sorted = [...list].sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity;
      return (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" });
    });
    return sorted.map((workflow) => ({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        tool: workflow.tool,
        severity: workflow.severity,
        bucket: "urgent" as const,
        issuesEnriched: workflow.issuesEnriched,
        issues: workflow.issues,
      },
      topIssue: workflow.issuesEnriched?.find((i) => i.bucket === "urgent") ?? workflow.issuesEnriched?.[0],
    }));
  }, [enriched]);

  const optimizationActions: ActionItem[] = useMemo(() => {
    const list = enriched.filter(
      (wf) => wf.hasOptimization && wf.enrichment.health !== "broken",
    );
    const sorted = [...list].sort((a, b) => b.severity - a.severity);
    return sorted.map((workflow) => ({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        tool: workflow.tool,
        severity: workflow.severity,
        bucket: "optimization" as const,
        issuesEnriched: workflow.issuesEnriched,
        issues: workflow.issues,
      },
      topIssue: workflow.issuesEnriched?.find((i) => i.bucket === "optimization") ?? workflow.issuesEnriched?.[0],
    }));
  }, [enriched]);

  const filtered = useMemo(() => {
    let result: EnrichedWorkflow[] = enriched;

    if (statusFilter === "ok") {
      result = result.filter((wf) => wf.active && wf.enrichment.health !== "broken");
    } else if (statusFilter === "broken") {
      result = result.filter((wf) => wf.enrichment.health === "broken");
    } else if (statusFilter === "inactive") {
      result = result.filter((wf) => !wf.active);
    }

    if (selectedTool) {
      result = result.filter((wf) => wf.tool === selectedTool);
    }

    return result;
  }, [enriched, statusFilter, selectedTool]);

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

  const fullWorkflowsForTable = useMemo(() => {
    const ids = new Set(filtered.map((wf) => wf.id));
    return workflows.filter((w) => ids.has(w.id));
  }, [filtered, workflows]);

  const { map: duplicateMap } = useMemo(
    () => detectDuplicates(filtered),
    [filtered],
  );

  const router = useRouter();

  const handleConnectSuccess = useCallback(() => {
    setShowConnectModal(false);
    router.refresh();
  }, [router]);

  useEffect(() => {
    const savedScroll = getDashboardScroll();
    if (savedScroll != null) {
      window.scrollTo(0, savedScroll);
      clearDashboardScroll();
    }
  }, []);

  const allSystemsOk = systemHealth >= 80 && executionFailures === 0;

  const okCount = enriched.filter((w) => w.active && w.enrichment.health !== "broken").length;
  const brokenCountAll = enriched.filter((w) => w.enrichment.health === "broken").length;
  const inactiveCountAll = enriched.filter((w) => !w.active).length;

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
      <SidebarTools
        workflows={workflows}
        selectedTool={selectedTool}
        onSelectTool={setSelectedTool}
        onAddIntegration={() => setShowConnectModal(true)}
      />

      <ConnectProviderModal
        open={showConnectModal}
        provider="n8n"
        onClose={() => setShowConnectModal(false)}
        onSuccess={handleConnectSuccess}
      />

      <div className="ml-[80px] px-8 py-6">
        <div className="max-w-[1360px] mx-auto">
          {/* Page Header */}
          <div className="flex items-end justify-between mb-7">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-gray-900" style={{ fontSize: "20px", lineHeight: 1.3 }}>
                  Governance
                </h1>
                <Badge variant={allSystemsOk ? "success" : "warning"}>
                  {allSystemsOk ? "All systems operational" : "Needs attention"}
                </Badge>
              </div>
              <p className="mt-1 text-[12px] text-gray-500">
                Discover, understand, and fix your automation system.
              </p>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Disconnect n8n"
                  title="Disconnect integration"
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                  onClick={async () => {
                    try {
                      await fetch("/api/integrations/n8n", {
                        method: "DELETE",
                      });
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
            {/* Section 1: System Overview */}
            <section>
              <SectionHeader title="System Overview" accent="bg-gray-300" />
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
            <ActionCenter
              urgentItems={urgentActions}
              optimizationItems={optimizationActions}
            />

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
                  total: enriched.length,
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
