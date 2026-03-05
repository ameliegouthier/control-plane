"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { WorkflowWithEnrichment, DuplicateMap } from "@/lib/enrichment";
import type { AutomationProvider } from "@/app/workflow-helpers";
import { getWorkflowRoute } from "@/app/workflow-helpers";
import type { Workflow } from "@/app/workflow-helpers";

type EnrichedWorkflow = WorkflowWithEnrichment & { tool: AutomationProvider };

interface WorkflowListProps {
  workflows: EnrichedWorkflow[];
  fullWorkflows: Workflow[];
  duplicateMap: DuplicateMap;
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
  return d.toLocaleDateString();
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
      <span className="inline-flex items-center gap-1.5 text-sm text-neutral-600">
        <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
        Inactive
      </span>
    );
  }
  if (health === "broken") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-red-600">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Broken
      </span>
    );
  }
  if (health === "warning" || health === "optimizable") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-600">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      OK
    </span>
  );
}

function ToolBadge({ tool }: { tool: AutomationProvider }) {
  const styles: Record<AutomationProvider, string> = {
    n8n: "bg-orange-100 text-orange-700 border-orange-200",
    zapier: "bg-amber-100 text-amber-700 border-amber-200",
    make: "bg-violet-100 text-violet-700 border-violet-200",
    airtable: "bg-sky-100 text-sky-700 border-sky-200",
  };
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${styles[tool] ?? "bg-neutral-100 text-neutral-600"}`}>
      {tool}
    </span>
  );
}

const GRID = "grid-cols-[minmax(0,2fr)_minmax(0,2fr)_80px_100px_80px_90px_80px]";

export default function WorkflowList({
  workflows,
  fullWorkflows,
}: WorkflowListProps) {
  const [search, setSearch] = useState("");

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

  if (workflows.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-6 py-12 text-center">
        <p className="text-sm text-neutral-500">No workflows match the filters.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-neutral-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="relative ml-auto">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-300 sm:w-56"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          <div className={`grid ${GRID} items-center gap-4 border-b border-neutral-200 bg-neutral-50/80 px-4 py-3 text-left`}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Name</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Route</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Tool</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Status</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Runs</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Last run</div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Owner</div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-neutral-500">
              No workflows match the current filters.
            </div>
          ) : (
            filtered.map((wf, idx) => {
              const full = workflowById.get(wf.id);
              const route = getWorkflowRoute(full?.graph);
              return (
                <Link
                  key={wf.id}
                  href={`/workflows/${wf.id}`}
                  className={`grid ${GRID} items-center gap-4 border-b border-neutral-100 px-4 py-3 text-left transition hover:bg-neutral-50 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-neutral-50/30"}`}
                >
                  <div className="min-w-0 truncate text-sm font-medium text-neutral-800">{wf.name}</div>
                  <div className="min-w-0 truncate text-sm text-neutral-600">{route}</div>
                  <div><ToolBadge tool={wf.tool} /></div>
                  <div><StatusCell active={wf.active} health={wf.enrichment.health} /></div>
                  <div className="text-sm text-neutral-600 tabular-nums">{mockRuns(wf.id)}</div>
                  <div className="text-sm text-neutral-500">{formatRelativeTime(wf.lastExecutionDate)}</div>
                  <div className="text-sm text-neutral-600">{mockOwner(wf.id)}</div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
