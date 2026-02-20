"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConnectProviderModal from "../connect-provider-modal";
import { getAllWorkflowsAsRaw, getAllWorkflows } from "@/lib/repositories/workflowsRepository";
import type { AutomationProvider } from "@/app/workflow-helpers";
import {
  type WorkflowWithEnrichment,
  type WorkflowDomain,
  getEnrichmentForWorkflow,
  detectDuplicates,
} from "@/lib/enrichment";

import SidebarTools from "./components/SidebarTools";
import TopDomainTabs from "./components/TopDomainTabs";
import KpiCards from "./components/KpiCards";
import NeedsAttentionPanel from "./components/NeedsAttentionPanel";
import WorkflowList from "./components/WorkflowList";

// ─── Extended type: workflow + enrichment + tool ─────────────────────────────

type EnrichedWorkflow = WorkflowWithEnrichment & { tool: AutomationProvider };

// ─── Overview Page ───────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [selectedDomain, setSelectedDomain] = useState<
    WorkflowDomain | "all"
  >("all");
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Close dropdown on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  // ─── Enrichment ──────────────────────────────────────────────

  // Get workflows from single source of truth
  const rawWorkflows = useMemo(() => getAllWorkflowsAsRaw(), []);
  const workflows = useMemo(() => getAllWorkflows(), []);

  const enriched: EnrichedWorkflow[] = useMemo(
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

  // ─── Domain counts (always on full dataset) ─────────────────

  const domainCounts = useMemo(() => {
    const map = new Map<WorkflowDomain, number>();
    for (const wf of enriched) {
      const d = wf.enrichment.domain;
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return map;
  }, [enriched]);

  // ─── Filtering: intersection of domain + tool ───────────────

  const filtered = useMemo(() => {
    let result: EnrichedWorkflow[] = enriched;
    if (selectedDomain !== "all") {
      result = result.filter(
        (wf) => wf.enrichment.domain === selectedDomain,
      );
    }
    if (selectedTool) {
      result = result.filter((wf) => wf.tool === selectedTool);
    }
    return result;
  }, [enriched, selectedDomain, selectedTool]);

  // ─── KPI counts ─────────────────────────────────────────────

  const totalCount = filtered.length;
  const activeCount = filtered.filter((w) => w.active).length;

  const brokenWorkflows = useMemo(
    () => filtered.filter((wf) => wf.enrichment.health === "broken"),
    [filtered],
  );
  const warningWorkflows = useMemo(
    () => filtered.filter((wf) => wf.enrichment.health === "warning"),
    [filtered],
  );
  const { pairs: duplicatePairs, map: duplicateMap } = useMemo(
    () => detectDuplicates(filtered),
    [filtered],
  );

  const needsAttentionCount =
    brokenWorkflows.length +
    warningWorkflows.length +
    duplicatePairs.length;

  // Overview display limits: 1 broken, 3 warnings, 1 duplicate
  const displayBroken = brokenWorkflows.slice(0, 1);
  const displayWarnings = warningWorkflows.slice(0, 3);
  const displayDuplicates = duplicatePairs.slice(0, 1);

  // ─── Handlers ───────────────────────────────────────────────

  const handleConnectSuccess = useCallback(() => {
    setShowConnectModal(false);
  }, []);

  const handleExportJson = useCallback(() => {
    const workflows = getAllWorkflows();
    const blob = new Blob(
      [JSON.stringify(workflows, null, 2)],
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

  return (
    <div className="min-h-screen bg-[#fafaf9]">
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

      <main className="pl-24">
        <div className="mx-auto max-w-6xl px-10 py-10">
          {/* ─── Top bar (2 rows like the mock) ───────────────── */}
          <div className="mb-8">
            {/* Row 1: actions on the right */}
            <div className="flex h-[26px] items-center justify-end gap-2">
              {/* Offline mode with menu */}
              <div className="relative h-full">
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((prev) => !prev);
                  }}
                  className="inline-flex h-full cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 text-[10px] font-medium text-zinc-500 transition hover:bg-zinc-50"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
                  Offline mode
                </span>

                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div
                      className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-lg shadow-zinc-900/5"
                      role="menu"
                    >
                      <Link
                        href="/workflows"
                        role="menuitem"
                        className="block px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        View all workflows
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleExportJson}
                        className="block w-full px-4 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
                      >
                        Export JSON
                      </button>
                      <Link
                        href="/connections"
                        role="menuitem"
                        className="block px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        Manage connections
                      </Link>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowConnectModal(true)}
                className="h-full rounded-xl bg-zinc-900 px-4 text-[10px] font-medium text-white transition hover:bg-zinc-800"
              >
                Connect n8n
              </button>
            </div>

            {/* Row 2: tabs aligned with container */}
            <div className="mt-6">
              <TopDomainTabs
                domains={domainCounts}
                selectedDomain={selectedDomain}
                onSelectDomain={setSelectedDomain}
                totalCount={enriched.length}
              />
            </div>
          </div>

          {/* ─── KPI Cards ───────────────────────────────────── */}
          <div className="mt-8">
            <KpiCards
              total={totalCount}
              active={activeCount}
              needsAttention={needsAttentionCount}
            />
          </div>

          {/* ─── Needs Attention ──────────────────────────────── */}
          <div className="mt-8">
            <NeedsAttentionPanel
              broken={displayBroken}
              warnings={displayWarnings}
              duplicates={displayDuplicates}
            />
          </div>

          {/* ─── Separator ──────────────────────────────────────── */}
          <div className="my-10 h-px bg-zinc-200" />

          {/* ─── Workflows List ─────────────────────────────────── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
                Workflows ({filtered.length})
              </h2>
              <Link
                href="/workflows"
                className="text-xs font-medium text-zinc-500 transition hover:text-zinc-700"
              >
                Open table view →
              </Link>
            </div>

            <WorkflowList workflows={filtered} duplicateMap={duplicateMap} />
          </section>
        </div>
      </main>
    </div>
  );
}
