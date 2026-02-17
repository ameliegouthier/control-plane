"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConnectN8nModal from "../connect-n8n-modal";
import { MOCK_WORKFLOWS } from "../data/mockWorkflows";
import {
  type WorkflowWithEnrichment,
  type HealthStatus,
  type RiskFlag,
  type WorkflowDomain,
  type DuplicateMap,
  type DuplicatePair,
  getEnrichmentForWorkflow,
  detectDuplicates,
} from "@/lib/enrichment";

// ─── Summary Card ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  accent = "indigo",
}: {
  label: string;
  value: number;
  accent?: "indigo" | "emerald" | "zinc" | "amber";
}) {
  const ring: Record<string, string> = {
    indigo: "border-indigo-200 bg-indigo-50/40",
    emerald: "border-emerald-200 bg-emerald-50/40",
    zinc: "border-zinc-200 bg-zinc-50/40",
    amber: "border-amber-200 bg-amber-50/40",
  };
  const num: Record<string, string> = {
    indigo: "text-indigo-700",
    emerald: "text-emerald-700",
    zinc: "text-zinc-600",
    amber: "text-amber-700",
  };

  return (
    <div className={`rounded-xl border px-5 py-4 ${ring[accent]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${num[accent]}`}>{value}</p>
    </div>
  );
}

// ─── Health Badge ────────────────────────────────────────────────────────────

function HealthBadge({ status }: { status: HealthStatus }) {
  const styles: Record<HealthStatus, string> = {
    ok: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    broken: "bg-red-200 text-red-900",
  };
  const labels: Record<HealthStatus, string> = {
    ok: "OK",
    warning: "Warning",
    broken: "Broken",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

// ─── Risk Flag Badges ────────────────────────────────────────────────────────

const FLAG_LABELS: Record<RiskFlag, { text: string; cls: string }> = {
  public_webhook: {
    text: "Public Webhook",
    cls: "bg-red-50 text-red-600 border-red-200",
  },
  no_trigger: {
    text: "No Trigger",
    cls: "bg-orange-50 text-orange-600 border-orange-200",
  },
  inactive: {
    text: "Inactive",
    cls: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  high_complexity: {
    text: "Complex",
    cls: "bg-violet-50 text-violet-600 border-violet-200",
  },
  unknown: {
    text: "Unknown",
    cls: "bg-zinc-100 text-zinc-500 border-zinc-200",
  },
};

function RiskFlagBadges({
  flags,
  duplicateOf,
}: {
  flags: RiskFlag[];
  duplicateOf?: string[];
}) {
  const hasBadges = flags.length > 0 || (duplicateOf && duplicateOf.length > 0);
  if (!hasBadges) {
    return <span className="text-[11px] text-zinc-300">&mdash;</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {flags.map((f) => (
        <span
          key={f}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${FLAG_LABELS[f].cls}`}
        >
          {FLAG_LABELS[f].text}
        </span>
      ))}
      {duplicateOf && duplicateOf.length > 0 && (
        <span
          title={`Similar to: ${duplicateOf.join(", ")}`}
          className="inline-flex cursor-help items-center rounded-full border border-orange-300 bg-transparent px-2 py-0.5 text-[10px] font-medium text-orange-600"
        >
          Duplicate?
        </span>
      )}
    </div>
  );
}

// ─── Time Ago ────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

// ─── Sync Indicator ──────────────────────────────────────────────────────────

function SyncIndicator({
  isConnected,
  lastSyncedAt,
  onSync,
  onConnect,
}: {
  isConnected: boolean;
  lastSyncedAt: Date | null;
  onSync: () => void;
  onConnect: () => void;
}) {
  if (isConnected) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1 text-[11px] font-medium text-emerald-700">
        <span className="relative flex h-2 w-2">
          <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-500" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span>
          Connected to n8n
          {lastSyncedAt && (
            <span className="text-emerald-500">
              {" · "}Last sync: {timeAgo(lastSyncedAt)}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onSync}
          className="ml-1 rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          Sync now
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-500">
      <span className="h-2 w-2 rounded-full bg-zinc-300" />
      <span>Offline mode — JSON import</span>
      <button
        type="button"
        onClick={onConnect}
        className="ml-1 rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600 transition hover:bg-zinc-100"
      >
        Connect n8n
      </button>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="text-3xl">📭</span>
      <p className="text-sm font-medium text-zinc-500">No workflows loaded</p>
      <p className="text-xs text-zinc-400">
        Import a JSON file or connect a data source to get started.
      </p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Smart truncation: keeps beginning and end of text, cuts the middle.
 * "Lead Magnet → Email Nurture → HubSpot Sync" → "Lead Magnet → ... → HubSpot Sync"
 */
function smartTruncate(text: string, max = 35): string {
  if (text.length <= max) return text;

  const separator = " → ";
  const parts = text.split(separator);

  if (parts.length >= 3) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    const truncated = `${first} → ... → ${last}`;
    if (truncated.length <= max + 10) return truncated;
  }

  const keep = Math.floor((max - 3) / 2);
  return `${text.slice(0, keep)}...${text.slice(-keep)}`;
}

function computeDomainCounts(
  workflows: WorkflowWithEnrichment[],
): [WorkflowDomain, number][] {
  const map = new Map<WorkflowDomain, number>();
  for (const wf of workflows) {
    const d = wf.enrichment.domain;
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function getBrokenWorkflows(
  workflows: WorkflowWithEnrichment[],
): WorkflowWithEnrichment[] {
  return workflows.filter((wf) => wf.enrichment.health === "broken");
}

function getWarningWorkflows(
  workflows: WorkflowWithEnrichment[],
): WorkflowWithEnrichment[] {
  return workflows.filter((wf) => wf.enrichment.health === "warning");
}

function AttentionItem({ wf }: { wf: WorkflowWithEnrichment }) {
  return (
    <div className="flex items-start gap-3 border-b border-zinc-100 py-2.5 last:border-0">
      <HealthBadge status={wf.enrichment.health} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800">{wf.name}</p>
        <p className="mt-0.5 text-[11px] text-zinc-400">
          {wf.enrichment.reason}
        </p>
      </div>
      <a
        href={`#workflow-${wf.id}`}
        className="shrink-0 text-[11px] font-medium text-indigo-500 hover:text-indigo-700"
      >
        View&nbsp;→
      </a>
    </div>
  );
}

// ─── Overview Page ───────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [domainFilter, setDomainFilter] = useState<WorkflowDomain | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const enriched: WorkflowWithEnrichment[] = useMemo(
    () =>
      MOCK_WORKFLOWS.map((w) => ({
        ...w,
        enrichment: getEnrichmentForWorkflow(w),
      })),
    [],
  );

  useEffect(() => {
    console.info(
      `[Overview] Mock AI enrichment computed for ${enriched.length} workflows`,
    );
  }, [enriched.length]);

  const handleDomainClick = useCallback((domain: WorkflowDomain) => {
    setDomainFilter((prev) => (prev === domain ? null : domain));
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const handleSync = useCallback(() => {
    setLastSyncedAt(new Date());
  }, []);

  const handleConnectSuccess = useCallback(() => {
    setIsConnected(true);
    setLastSyncedAt(new Date());
    setShowConnectModal(false);
  }, []);

  if (enriched.length === 0) {
    return (
      <div className="min-h-screen bg-white px-6 py-10">
        <h1 className="text-xl font-semibold text-zinc-900">Overview</h1>
        <EmptyState />
      </div>
    );
  }

  const totalActive = enriched.filter((w) => w.active).length;
  const brokenWfs = getBrokenWorkflows(enriched);
  const warningWfs = getWarningWorkflows(enriched);
  const { pairs: duplicatePairs, map: duplicateMap } = useMemo(
    () => detectDuplicates(enriched),
    [enriched],
  );
  const needsAttentionCount =
    brokenWfs.length + warningWfs.length + (duplicatePairs.length > 0 ? 1 : 0);
  const domainCounts = computeDomainCounts(enriched);

  const displayedWorkflows = domainFilter
    ? enriched.filter((wf) => wf.enrichment.domain === domainFilter)
    : enriched;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* ─── Header ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Overview</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {isConnected
                ? "Live data from n8n instance"
                : "Offline mode — JSON import (mock AI enrichment)"}
            </p>
          </div>
          <SyncIndicator
            isConnected={isConnected}
            lastSyncedAt={lastSyncedAt}
            onSync={handleSync}
            onConnect={() => setShowConnectModal(true)}
          />
        </div>

        <ConnectN8nModal
          open={showConnectModal}
          onClose={() => setShowConnectModal(false)}
          onSuccess={handleConnectSuccess}
        />

        {/* ─── Summary cards ──────────────────────────────────────── */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <SummaryCard
            label="Total workflows"
            value={enriched.length}
            accent="indigo"
          />
          <SummaryCard label="Active" value={totalActive} accent="emerald" />
          <SummaryCard
            label="Needs attention"
            value={needsAttentionCount}
            accent="amber"
          />
        </div>

        {/* ─── Domain breakdown + Needs attention ─────────────────── */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Domain breakdown */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/40 px-5 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Domain Breakdown
            </h2>
            <div className="mt-3">
              {domainCounts.map(([domain, count]) => {
                const isActive = domainFilter === domain;
                return (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => handleDomainClick(domain)}
                    className={`flex w-full items-center justify-between border-b border-zinc-100 py-2 text-left transition last:border-0 ${
                      isActive
                        ? "rounded-md bg-indigo-50 px-2 -mx-2"
                        : "hover:bg-zinc-100/60 rounded-md px-2 -mx-2"
                    }`}
                  >
                    <span
                      className={`text-sm ${isActive ? "font-semibold text-indigo-700" : "text-zinc-700"}`}
                    >
                      {domain}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isActive
                          ? "bg-indigo-600 text-white"
                          : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Needs attention */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/40 px-5 py-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Needs Attention
            </h2>

            {needsAttentionCount === 0 ? (
              <p className="mt-3 text-sm text-zinc-400">
                All workflows look healthy.
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                {/* ── Broken group ── */}
                {brokenWfs.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-red-700">
                      🔴 Broken — Action Required
                    </p>
                    <div className="rounded-lg border border-red-200 bg-red-50/40 px-3 py-1">
                      {brokenWfs.map((wf) => (
                        <AttentionItem key={wf.id} wf={wf} />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Warning group ── */}
                {warningWfs.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-amber-700">
                      🟡 Warnings — Monitor These
                    </p>
                    <div className="rounded-lg border border-amber-200 bg-amber-50/30 px-3 py-1">
                      {warningWfs.map((wf) => (
                        <AttentionItem key={wf.id} wf={wf} />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Duplicates group ── */}
                {duplicatePairs.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-orange-600">
                      ⚠️ Potential Duplicates
                    </p>
                    <div className="rounded-lg border border-orange-200 bg-orange-50/30 px-3 py-1">
                      {duplicatePairs.map((pair) => (
                        <div
                          key={`${pair.idA}:${pair.idB}`}
                          className="flex items-start gap-3 border-b border-zinc-100 py-2.5 last:border-0"
                        >
                          <span className="inline-flex shrink-0 items-center rounded-full border border-orange-300 px-2 py-0.5 text-[10px] font-medium text-orange-600">
                            Duplicate?
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-zinc-800">
                              {pair.nameA}
                            </p>
                            <p className="mt-0.5 text-[11px] text-zinc-400">
                              {pair.reason === "exact_name"
                                ? "Appears twice with the same name"
                                : `Similar to: ${pair.nameB}`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── Workflows table ────────────────────────────────────── */}
        <div className="mt-8" ref={tableRef}>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Workflows ({displayedWorkflows.length}
              {domainFilter ? ` of ${enriched.length}` : ""})
            </h2>

            {domainFilter && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700">
                {domainFilter}
                <button
                  type="button"
                  onClick={() => setDomainFilter(null)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-200/60"
                  aria-label="Clear filter"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  <th className="w-[28%] px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Health</th>
                  <th className="px-4 py-2.5">Domain</th>
                  <th className="px-4 py-2.5">Output</th>
                  <th className="w-[22%] px-4 py-2.5">Risk Flags</th>
                </tr>
              </thead>
              <tbody>
                {displayedWorkflows.map((wf) => {
                  const truncatedName = smartTruncate(wf.name, 35);
                  const truncatedOutput = smartTruncate(wf.enrichment.output, 35);
                  const nameNeedsTooltip = truncatedName !== wf.name;
                  const outputNeedsTooltip = truncatedOutput !== wf.enrichment.output;

                  return (
                    <tr
                      key={wf.id}
                      id={`workflow-${wf.id}`}
                      className="cursor-pointer border-b border-zinc-50 transition last:border-0 hover:bg-indigo-50/30"
                    >
                      <td
                        className="max-w-0 px-4 py-3 font-medium text-zinc-800"
                        title={nameNeedsTooltip ? wf.name : undefined}
                      >
                        <span className="block truncate">
                          {truncatedName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            wf.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-zinc-100 text-zinc-400"
                          }`}
                        >
                          {wf.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <HealthBadge status={wf.enrichment.health} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {wf.enrichment.domain}
                      </td>
                      <td
                        className="max-w-0 px-4 py-3 text-zinc-500"
                        title={outputNeedsTooltip ? wf.enrichment.output : undefined}
                      >
                        <span className="block truncate">
                          {truncatedOutput}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <RiskFlagBadges
                          flags={wf.enrichment.riskFlags}
                          duplicateOf={duplicateMap.get(wf.id)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
