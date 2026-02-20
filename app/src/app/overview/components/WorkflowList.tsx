import Link from "next/link";
import type { WorkflowWithEnrichment, DuplicateMap } from "@/lib/enrichment";
import type { AutomationProvider } from "@/app/workflow-helpers";
import { N8nIcon, ZapierIcon, MakeIcon, AirtableIcon } from "./SidebarTools";

type EnrichedWorkflow = WorkflowWithEnrichment & { tool: AutomationProvider };

interface WorkflowListProps {
  workflows: EnrichedWorkflow[];
  duplicateMap: DuplicateMap;
}

/**
 * Nouvelle grille :
 * PROVIDER fixe (tool icon)
 * NAME large
 * STATUS fixe
 * HEALTH fixe
 * DOMAIN moyen
 * OUTPUT large (focus principal)
 */
const GRID = "grid-cols-[56px_2fr_110px_110px_180px_2.2fr]";

// ─── Badge helpers ────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        active
          ? "bg-emerald-100 text-emerald-700"
          : "bg-zinc-100 text-zinc-400"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function HealthBadge({ status }: { status: "ok" | "warning" | "broken" }) {
  const styles: Record<"ok" | "warning" | "broken", string> = {
    ok: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    broken: "bg-red-200 text-red-900",
  };

  const labels: Record<"ok" | "warning" | "broken", string> = {
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

// ─── Smart truncate ───────────────────────────────────────────────────────────

function smartTruncate(text: string, max = 50): string {
  if (text.length <= max) return text;

  const keep = Math.floor((max - 3) / 2);
  return `${text.slice(0, keep)}...${text.slice(-keep)}`;
}

// ─── Provider Icon ─────────────────────────────────────────────────────────────

function ProviderIcon({ tool }: { tool: AutomationProvider }) {
  const iconProps = { className: "h-4 w-4" };
  
  const toolStyles: Record<AutomationProvider, string> = {
    n8n: "bg-rose-100 text-rose-600 border-rose-200",
    zapier: "bg-orange-100 text-orange-600 border-orange-200",
    make: "bg-violet-100 text-violet-600 border-violet-200",
    airtable: "bg-sky-100 text-sky-600 border-sky-200",
  };
  
  const containerClass = `flex h-7 w-7 items-center justify-center rounded-lg border ${toolStyles[tool]}`;
  
  switch (tool) {
    case "n8n":
      return (
        <div className={containerClass}>
          <N8nIcon {...iconProps} />
        </div>
      );
    case "zapier":
      return (
        <div className={containerClass}>
          <ZapierIcon {...iconProps} />
        </div>
      );
    case "make":
      return (
        <div className={containerClass}>
          <MakeIcon {...iconProps} />
        </div>
      );
    case "airtable":
      return (
        <div className={containerClass}>
          <AirtableIcon {...iconProps} />
        </div>
      );
    default:
      return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkflowList({
  workflows,
}: WorkflowListProps) {
  if (workflows.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center">
        <p className="text-sm text-zinc-400">
          No workflows match the filters.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-[10px] bg-white">
      <div className="overflow-clip rounded-[inherit]">
        <div className="flex flex-col p-px">

          {/* HEADER */}
          <div
            className={`grid ${GRID} w-full items-center gap-4 border-b border-zinc-200/60 bg-zinc-50/30 px-6 py-3`}
          >
            <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {/* Provider column - no header text, just icon */}
            </div>

            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Name
            </div>

            <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Status
            </div>

            <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Health
            </div>

            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Domain
            </div>

            <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Output
            </div>
          </div>

          {/* ROWS */}
          <div className="w-full">
            {workflows.map((wf, idx) => {
              const truncatedName = smartTruncate(wf.name, 40);
              const truncatedOutput = smartTruncate(
                wf.enrichment.output,
                80
              );

              return (
                <Link
                  key={wf.id}
                  href={`/workflows/${wf.id}`}
                  className={`grid ${GRID} w-full items-center gap-4 border-b border-zinc-200/60 px-6 py-3 transition hover:bg-zinc-50/40 last:border-0 ${
                    idx % 2 === 0 ? "bg-white" : "bg-zinc-50/20"
                  }`}
                >
                  {/* PROVIDER */}
                  <div className="flex items-center justify-center">
                    <ProviderIcon tool={wf.tool} />
                  </div>

                  {/* NAME */}
                  <div className="min-w-0 text-sm font-medium text-zinc-800">
                    <span className="block truncate">{truncatedName}</span>
                  </div>

                  {/* STATUS */}
                  <div className="flex items-center justify-center">
                    <StatusBadge active={wf.active} />
                  </div>

                  {/* HEALTH */}
                  <div className="flex items-center justify-center">
                    <HealthBadge status={wf.enrichment.health} />
                  </div>

                  {/* DOMAIN */}
                  <div className="text-sm text-zinc-600">
                    {wf.enrichment.domain}
                  </div>

                  {/* OUTPUT (focus principal) */}
                  <div className="min-w-0 text-sm text-zinc-500">
                    <span className="block truncate">
                      {truncatedOutput}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[10px] border border-zinc-200"
      />
    </div>
  );
}