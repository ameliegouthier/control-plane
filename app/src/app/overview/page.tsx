"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConnectProviderModal from "../connect-provider-modal";
import { getAllWorkflowsAsRaw, getAllWorkflows } from "@/lib/repositories/workflowsRepository";
import type { AutomationProvider } from "@/app/workflow-helpers";
import {
  type WorkflowWithFullEnrichment,
  type HealthStatus,
  getEnrichmentForWorkflow,
  detectDuplicates,
  addIssuesToEnrichedWorkflows,
} from "@/lib/enrichment";

import SidebarTools from "./components/SidebarTools";
import KpiCards, { computeSystemHealth } from "./components/KpiCards";
import SystemMap from "./components/SystemMap";
import WorkflowList from "./components/WorkflowList";
import ActionCenter, { type ActionItem } from "./components/ActionCenter";

type EnrichedWorkflow = WorkflowWithFullEnrichment & { tool: AutomationProvider };

export type StatusFilter = "all" | "ok" | "broken" | "inactive";

export default function OverviewPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  // ─── Enrichment ──────────────────────────────────────────────

  const rawWorkflows = useMemo(() => getAllWorkflowsAsRaw(), []);
  const workflows = useMemo(() => getAllWorkflows(), []);

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

  // ─── Urgent (broken only) vs Optimization ─────────────────────────────

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

  // ─── Filtering (status + tool) ───────────────────────────────

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

  // ─── KPI metrics ─────────────────────────────────────────────

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

  // ─── Handlers ───────────────────────────────────────────────

  const handleConnectSuccess = useCallback(() => {
    setShowConnectModal(false);
  }, []);

  const handleExportJson = useCallback(() => {
    const wfs = getAllWorkflows();
    const blob = new Blob(
      [JSON.stringify(wfs, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workflows.json";
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  }, []);

  // ─── Render ─────────────────────────────────────────────────

  const allSystemsOk = systemHealth >= 80 && executionFailures === 0;

  const okCount = enriched.filter((w) => w.active && w.enrichment.health !== "broken").length;
  const brokenCountAll = enriched.filter((w) => w.enrichment.health === "broken").length;
  const inactiveCountAll = enriched.filter((w) => !w.active).length;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <SidebarTools
        selectedTool={selectedTool}
        onSelectTool={setSelectedTool}
      />

      <ConnectProviderModal
        open={showConnectModal}
        provider="n8n"
        onClose={() => setShowConnectModal(false)}
        onSuccess={handleConnectSuccess}
      />

      <main className="pl-20">
        <div className="mx-auto max-w-[1360px] px-8 py-8">
          {/* ─── Header ─────────────────────────────────────────── */}
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-neutral-900">Governance</h1>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${allSystemsOk ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {allSystemsOk ? "All systems operational" : "Needs attention"}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                Discover, understand, and fix your automation system.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Last synced 2m ago
              </span>
              <div className="relative">
                <span
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((prev) => !prev); }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                  Offline mode
                </span>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border border-neutral-200 bg-white py-1.5 shadow-lg" role="menu">
                      <Link href="/workflows" role="menuitem" className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50" onClick={() => setMenuOpen(false)}>View all workflows</Link>
                      <button type="button" role="menuitem" onClick={handleExportJson} className="block w-full px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50">Export JSON</button>
                      <Link href="/connections" role="menuitem" className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50" onClick={() => setMenuOpen(false)}>Manage connections</Link>
                    </div>
                  </>
                )}
              </div>
              <button type="button" onClick={() => setShowConnectModal(true)} className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-neutral-800">Connect n8n</button>
            </div>
          </div>

          {/* Status filter: All | OK | Broken | Inactive */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === "all"
                  ? "bg-neutral-800 text-white"
                  : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              All {enriched.length}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ok")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === "ok"
                  ? "bg-neutral-800 text-white"
                  : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              OK {okCount}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("broken")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === "broken"
                  ? "bg-neutral-800 text-white"
                  : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              Broken {brokenCountAll}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === "inactive"
                  ? "bg-neutral-800 text-white"
                  : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              Inactive {inactiveCountAll}
            </button>
          </div>

          {/* 1 ─── System Overview ─────────────────────────────── */}
          <section className="mt-10">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-4 w-px bg-neutral-300" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">System Overview</h2>
            </div>
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

          {/* 2 ─── System Map ──────────────────────────────────── */}
          <div className="mt-10">
            <SystemMap workflows={filtered} />
          </div>

          <div className="my-10 h-px bg-neutral-200" />

          {/* 3 ─── Action Center ────────────────────────────────── */}
          <ActionCenter urgentItems={urgentActions} optimizationItems={optimizationActions} />

          <div className="my-10 h-px bg-neutral-200" />

          {/* 4 ─── Workflow Table ───────────────────────────────── */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <div className="h-4 w-px bg-neutral-300" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">All Workflows</h2>
            </div>
            <WorkflowList workflows={filtered} fullWorkflows={fullWorkflowsForTable} duplicateMap={duplicateMap} />
          </section>
        </div>
      </main>
    </div>
  );
}
