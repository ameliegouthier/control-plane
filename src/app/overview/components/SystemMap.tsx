"use client";

import Link from "next/link";
import type { WorkflowWithEnrichment } from "@/lib/enrichment";
import type { AutomationProvider } from "@/app/workflow-helpers";
import { getDestinationByName, nameToSlug } from "@/app/data/destinations";
import { SectionHeader } from "@/components/ui";

type EnrichedWorkflow = WorkflowWithEnrichment & { tool: AutomationProvider };

const DEST_COLORS: Record<string, { bg: string; text: string }> = {
  orange: { bg: "bg-orange-50", text: "text-orange-600" },
  violet: { bg: "bg-purple-50", text: "text-purple-600" },
  neutral: { bg: "bg-gray-100", text: "text-gray-800" },
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  emerald: { bg: "bg-green-50", text: "text-green-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-700" },
};

function getDestinationStyles(destinationName: string) {
  const meta = getDestinationByName(destinationName);
  if (meta && DEST_COLORS[meta.accent]) {
    const c = DEST_COLORS[meta.accent];
    return { abbrev: meta.abbrev, bg: c.bg, text: c.text };
  }
  const abbrev = destinationName.slice(0, 2);
  return { abbrev, bg: "bg-gray-100", text: "text-gray-800" };
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
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
        <SectionHeader title="System Map" accent="bg-indigo-400" />
        <div
          className="bg-white rounded-xl px-6 py-12 text-center"
          style={{ border: '1px solid rgba(0,0,0,0.07)' }}
        >
          <p className="text-[13px] text-gray-400">No destinations to show.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        title="System Map"
        accent="bg-indigo-400"
        count={`${sortedDestinations.length} destination${sortedDestinations.length !== 1 ? "s" : ""}`}
      />
      <div className="grid grid-cols-3 gap-2.5">
        {sortedDestinations.map(([destination, list]) => {
          const slug = nameToSlug(destination);
          const icon = getDestinationStyles(destination);
          return (
            <Link
              key={destination}
              href={`/destination/${slug}`}
              className="bg-white rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md group"
              style={{ border: '1px solid rgba(0,0,0,0.07)' }}
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${icon.bg} flex items-center justify-center`}>
                    <span className={`text-[11px] ${icon.text}`}>{icon.abbrev}</span>
                  </div>
                  <div>
                    <div className="text-[14px] text-gray-900">{destination}</div>
                    <div className="text-[11px] text-gray-400">
                      {list.length} workflow{list.length !== 1 ? "s" : ""} connected
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-200 group-hover:text-gray-400 transition-colors" />
              </div>
              {/* Workflow list */}
              <div className="px-5 pb-5 space-y-3">
                {list.map((wf) => (
                  <div key={wf.id}>
                    <div className="text-[13px] text-gray-800">{wf.name}</div>
                    <div className="text-[12px] text-gray-400">{wf.enrichment.output}</div>
                  </div>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
