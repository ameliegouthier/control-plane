"use client";

import Link from "next/link";
import type { WorkflowWithEnrichment } from "@/lib/enrichment";
import type { AutomationProvider } from "@/app/workflow-helpers";
import { getDestinationByName, nameToSlug } from "@/app/data/destinations";

type EnrichedWorkflow = WorkflowWithEnrichment & { tool: AutomationProvider };

const ACCENT_CLASSES: Record<string, { bg: string; text: string }> = {
  orange: { bg: "bg-orange-100", text: "text-orange-700" },
  violet: { bg: "bg-violet-100", text: "text-violet-700" },
  neutral: { bg: "bg-neutral-100", text: "text-neutral-700" },
  blue: { bg: "bg-blue-100", text: "text-blue-700" },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-700" },
  amber: { bg: "bg-amber-100", text: "text-amber-700" },
};

function getDestinationStyles(destinationName: string) {
  const meta = getDestinationByName(destinationName);
  if (meta && ACCENT_CLASSES[meta.accent]) {
    const c = ACCENT_CLASSES[meta.accent];
    return { abbrev: meta.abbrev, bg: c.bg, text: c.text };
  }
  const abbrev = destinationName.slice(0, 2);
  return { abbrev, bg: "bg-neutral-100", text: "text-neutral-700" };
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

interface SystemMapProps {
  workflows: EnrichedWorkflow[];
}

export default function SystemMap({ workflows }: SystemMapProps) {
  const byDestination = new Map<string, EnrichedWorkflow[]>();
  for (const wf of workflows) {
    const dest = wf.enrichment.output;
    if (!dest) continue;
    const list = byDestination.get(dest) ?? [];
    list.push(wf);
    byDestination.set(dest, list);
  }

  const sortedDestinations = Array.from(byDestination.entries()).sort(
    (a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
  );

  if (sortedDestinations.length === 0) {
    return (
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="h-4 w-px bg-neutral-300" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            System Map
          </h2>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-neutral-500">No destinations to show.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-px bg-neutral-300" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            System Map
          </h2>
        </div>
        <span className="text-xs text-neutral-500">
          {sortedDestinations.length} destination{sortedDestinations.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sortedDestinations.map(([destination, list]) => {
          const slug = nameToSlug(destination);
          const icon = getDestinationStyles(destination);
          return (
            <Link
              key={destination}
              href={`/destination/${slug}`}
              className="relative block rounded-lg border border-neutral-200 bg-white p-5 transition hover:border-neutral-300 hover:shadow-md"
            >
              <div className="absolute right-3 top-3 text-neutral-400">
                <ChevronRight className="h-4 w-4" />
              </div>
              <div className="mb-3 flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${icon.bg} ${icon.text}`}>
                  {icon.abbrev}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-neutral-800">{destination}</div>
                  <p className="text-xs text-neutral-500">
                    {list.length} workflow{list.length !== 1 ? "s" : ""} connected
                  </p>
                </div>
              </div>
              <ul className="space-y-2">
                {list.map((wf) => (
                  <li key={wf.id}>
                    <span className="text-sm font-medium text-neutral-700">{wf.name}</span>
                  </li>
                ))}
              </ul>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
