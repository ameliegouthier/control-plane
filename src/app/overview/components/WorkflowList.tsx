 "use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveDashboardScroll } from "@/lib/dashboard-scroll";
import type { WorkflowWithEnrichment, DuplicateMap } from "@/lib/enrichment";
import type { AutomationProvider } from "@/app/workflow-helpers";
import type { Workflow } from "@/app/workflow-helpers";
import { generateDraftIntent } from "@/lib/intent";

type EnrichedWorkflow = WorkflowWithEnrichment & { tool: AutomationProvider };

export type StatusFilterValue = "all" | "ok" | "broken" | "inactive";

interface WorkflowListProps {
  workflows: EnrichedWorkflow[];
  fullWorkflows: Workflow[];
  duplicateMap: DuplicateMap;
  statusFilter?: StatusFilterValue;
  onStatusFilterChange?: (filter: StatusFilterValue) => void;
  statusCounts?: { total: number; ok: number; broken: number; inactive: number };
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffM = Math.floor(diffMs / 60_000);
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function mockRuns(id: string): string {
  const n = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return ((n % 9000) + 100).toLocaleString();
}

function mockOwner(id: string): string {
  const names = ["Sarah M.", "Mike R.", "Alex K.", "Jordan L.", "Sam P."];
  const i = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % names.length;
  return names[i];
}

function StatusCell({ active, health }: { active: boolean; health: string }) {
  if (!active) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
        <span className="w-[5px] h-[5px] rounded-full bg-gray-300" />
        Inactive
      </span>
    );
  }
  if (health === "broken") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-red-600">
        <span className="w-[5px] h-[5px] rounded-full bg-red-500" />
        Broken
      </span>
    );
  }
  if (health === "warning" || health === "optimizable") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700">
        <span className="w-[5px] h-[5px] rounded-full bg-amber-500" />
        Warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700">
      <span className="w-[5px] h-[5px] rounded-full bg-emerald-500" />
      OK
    </span>
  );
}

const TOOL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  n8n: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100" },
  zapier: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
  make: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-100" },
  airtable: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
};

function ToolBadge({ tool }: { tool: AutomationProvider }) {
  const s = TOOL_STYLES[tool] ?? { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-100" };
  return (
    <span className={`text-[10px] px-1.5 py-[2px] rounded border ${s.bg} ${s.text} ${s.border}`}>
      {tool}
    </span>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ChevronDown({ className, expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const PROBLEM_SOLVED_TRUNCATE = 56;
const COLLAPSED_SIZE = 5;
const PAGE_SIZE = 10;

function truncate(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen).trim() + "…";
}

export default function WorkflowList({
  workflows,
  fullWorkflows,
  statusFilter,
  onStatusFilterChange,
  statusCounts,
}: WorkflowListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [listExpanded, setListExpanded] = useState(false);

  const workflowById = useMemo(() => {
    const map = new Map<string, Workflow>();
    fullWorkflows.forEach((w) => map.set(w.id, w));
    return map;
  }, [fullWorkflows]);

  const filtered = useMemo(() => {
    if (!search.trim()) return workflows;
    const q = search.trim().toLowerCase();
    return workflows.filter((w) => w.name.toLowerCase().includes(q));
  }, [workflows, search]);

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedRows = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [filtered, currentPage]
  );

  const displayedRows = listExpanded ? paginatedRows : filtered.slice(0, COLLAPSED_SIZE);
  const hasMoreWorkflows = filtered.length > COLLAPSED_SIZE;
  const showExpandButton = filtered.length > 0 && hasMoreWorkflows;

  const showStatusFilter = statusFilter != null && onStatusFilterChange != null && statusCounts != null;

  if (workflows.length === 0) {
    return (
      <div
        className="bg-white rounded-xl px-4 py-10 text-center"
        style={{ border: '1px solid rgba(0,0,0,0.08)' }}
      >
        <p className="text-[13px] text-gray-400">No workflows match the filters.</p>
      </div>
    );
  }

  const filters: { value: StatusFilterValue; label: string; count: number }[] = [
    { value: "all", label: "All", count: statusCounts?.total ?? 0 },
    { value: "ok", label: "OK", count: statusCounts?.ok ?? 0 },
    { value: "broken", label: "Broken", count: statusCounts?.broken ?? 0 },
    { value: "inactive", label: "Inactive", count: statusCounts?.inactive ?? 0 },
  ];

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2.5">
        {showStatusFilter ? (
          <div className="flex items-center gap-1 bg-gray-100/80 rounded-lg p-0.5">
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => onStatusFilterChange?.(f.value)}
                className={`px-2.5 py-1.5 text-[11px] rounded-md transition-all duration-150 flex items-center gap-1.5 ${
                  statusFilter === f.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f.label}
                <span className="text-[10px] text-gray-400">{f.count}</span>
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-[13px] bg-white border rounded-lg focus:ring-1 focus:ring-gray-200 outline-none w-56 placeholder-gray-300"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          />
        </div>
      </div>

      {/* Table */}
      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(0,0,0,0.08)' }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-400">Name</th>
              <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-400">Problem solved</th>
              <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-400">Tool</th>
              <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-400">Status</th>
              <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-400">Runs</th>
              <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-400">Last run</th>
              <th className="px-2 py-2.5 text-left text-[10px] uppercase tracking-wider text-gray-400" aria-label="Delete column" />
              <th className="px-3 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[13px] text-gray-400">
                  No workflows match the current filters.
                </td>
              </tr>
            ) : (
              displayedRows.map((wf) => {
                const full = workflowById.get(wf.id);
                const problemSolved = full
                  ? generateDraftIntent(full).problemSolved
                  : "—";
                const problemSolvedShort = truncate(problemSolved, PROBLEM_SOLVED_TRUNCATE);
                return (
                  <tr
                    key={wf.id}
                    className="hover:bg-gray-50/40 transition-colors group cursor-default"
                    style={{ borderBottom: "1px solid rgba(0,0,0,0.03)" }}
                  >
                    <td className="px-4 py-2.5 text-[13px] text-gray-900">
                      {wf.name}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-400">{problemSolvedShort}</td>
                    <td className="px-4 py-2.5"><ToolBadge tool={wf.tool} /></td>
                    <td className="px-4 py-2.5"><StatusCell active={wf.active} health={wf.enrichment.health} /></td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-500 tabular-nums">{mockRuns(wf.id)}</td>
                    <td className="px-4 py-2.5 text-[12px] text-gray-400">{formatRelativeTime(wf.lastExecutionDate)}</td>
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        aria-label={`Delete workflow ${wf.name}`}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              "Delete this workflow from the system?",
                            )
                          ) {
                            return;
                          }
                          try {
                            await fetch(`/api/workflows/${wf.id}`, {
                              method: "DELETE",
                            });
                            router.refresh();
                          } catch {
                            // Ignore network errors for now; user can retry.
                          }
                        }}
                      >
                        <TrashIcon className="w-[13px] h-[13px]" />
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/workflows/${wf.id}`}
                        onClick={() => saveDashboardScroll()}
                        className="inline-flex items-center justify-center cursor-pointer text-gray-300 hover:text-gray-800 transition-all"
                        aria-label={`Open workflow ${wf.name}`}
                      >
                        <ExternalLinkIcon className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination (only when list is expanded and more than one page) */}
        {filtered.length > 0 && listExpanded && totalPages > 1 && (
          <div
            className="flex items-center justify-center gap-4 py-2.5"
            style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}
          >
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="text-[12px] text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>
            <span className="text-[12px] text-gray-400">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="text-[12px] text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        )}

        {/* Show more workflows / Show less */}
        {showExpandButton && (
          <button
            type="button"
            onClick={() => {
              if (!listExpanded) setPage(0);
              setListExpanded((e) => !e);
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 cursor-pointer transition-colors duration-150 hover:bg-gray-50"
            style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}
          >
            <span className="text-[11px] text-gray-400">
              {listExpanded ? "Show less" : `Show more workflows (${filtered.length})`}
            </span>
            <ChevronDown
              className="w-3 h-3 text-gray-400 transition-transform duration-200"
              expanded={listExpanded}
            />
          </button>
        )}
      </div>
    </div>
  );
}
