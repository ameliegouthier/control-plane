"use client";

import Link from "next/link";
import type { WorkflowWithFullEnrichment } from "@/lib/enrichment";
import type { AutomationProvider, WorkflowGraph } from "@/app/workflow-helpers";
import { getDestinationByName, nameToSlug } from "@/app/data/destinations";
import { SectionHeader, ArrowRightIcon, Badge } from "@/components/ui";

type EnrichedWorkflow = WorkflowWithFullEnrichment & {
  tool: AutomationProvider;
  /** Graph from normalized workflow (for service-based grouping). */
  graph?: WorkflowGraph;
};

const DEST_COLORS: Record<string, { bg: string; text: string }> = {
  orange: { bg: "bg-orange-50", text: "text-orange-600" },
  violet: { bg: "bg-purple-50", text: "text-purple-600" },
  neutral: { bg: "bg-gray-100", text: "text-gray-800" },
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  emerald: { bg: "bg-green-50", text: "text-green-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-700" },
};

function getDestinationStyles(serviceName: string) {
  const meta = getDestinationByName(serviceName);
  if (meta && DEST_COLORS[meta.accent]) {
    const c = DEST_COLORS[meta.accent];
    return { abbrev: meta.abbrev, bg: c.bg, text: c.text };
  }
  const abbrev = serviceName.slice(0, 2);
  return { abbrev, bg: "bg-gray-100", text: "text-gray-800" };
}

/** CamelCase to kebab-case (e.g. "googleSheets" → "google-sheets") for consistent grouping. */
function toNormalizedService(raw: string): string {
  return raw
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .trim();
}

/** Format normalized service for display (e.g. "google-sheets" → "Google Sheets"). */
function formatServiceLabel(service: string): string {
  return service
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Orchestration/internal nodes that must NOT appear as external services in the System Map.
const INTERNAL_SERVICES = new Set([
  "webhook",
  "cron",
  "schedule",
  "scheduletrigger",
  "respondtowebhook",
  "formtrigger",
  "trigger",
  "if",
  "router",
  "merge",
  "switch",
  "set",
  "code",
  "function",
  "http",
  "tools",
]);

const AGENT_SERVICES = new Set([
  "ai-local-agent",
]);

const INPUT_SERVICES = new Set([
  "fillout",
]);

/** Actions that modify external systems (write/send). Only these appear in the System Map. */
const MUTATION_ACTIONS = [
  "create",
  "update",
  "delete",
  "write",
  "append",
  "send",
  "post",
  "add",
];

function isMutation(action: string | undefined | null): boolean {
  if (!action || !action.trim()) return false;
  const a = action.toLowerCase();
  return MUTATION_ACTIONS.some((m) => a.includes(m));
}

/**
 * Extract unique external services used by a workflow for System Map grouping.
 * Only nodes with mutation actions (create, update, write, send, etc.) are included.
 * INTERNAL_SERVICES / AGENT_SERVICES / INPUT_SERVICES are filtered out.
 */
function getWorkflowServices(workflow: EnrichedWorkflow): string[] {
  const nodes = workflow.graph?.nodes ?? [];
  const rawServices = new Set<string>();
  const nodeWithModule = (n: (typeof nodes)[number]) => n as (typeof n) & { module?: string };

  for (const node of nodes) {
    const rawService =
      (typeof node.service === "string" && node.service.trim() ? node.service.trim() : null) ??
      (nodeWithModule(node).module ? nodeWithModule(node).module!.split(":")[0] : null) ??
      (node.type ? node.type.split(".").pop() ?? null : null);

    const service = rawService ? toNormalizedService(rawService) : undefined;

    if (process.env.NODE_ENV === "development") {
      console.log("SYSTEM_MAP_DEBUG: node parsed", {
        nodeType: node.type,
        nodeModule: nodeWithModule(node).module,
        service,
      });
    }

    if (!service) continue;
    if (!isMutation(node.action ?? node.operation)) continue;

    rawServices.add(service);
  }

  const filtered = Array.from(rawServices).filter((service) => {
    const s = service.toLowerCase();
    if (INTERNAL_SERVICES.has(s)) return false;
    if (AGENT_SERVICES.has(s)) return false;
    if (INPUT_SERVICES.has(s)) return false;
    return true;
  });

  return filtered;
}


function getNodeCount(service: string, list: EnrichedWorkflow[]): number {
  return list.reduce((acc, wf) => {
    const nodes = wf.graph?.nodes ?? [];
    return acc + nodes.filter((n) => {
      const s = toNormalizedService(n.service ?? "");
      return s === service;
    }).length;
  }, 0);
}

interface SystemMapProps {
  workflows: EnrichedWorkflow[];
}

export default function SystemMap({ workflows }: SystemMapProps) {
  // Group workflows by service (from workflow.graph.nodes[].service).
  // A workflow can appear under multiple services (e.g. Airtable + Slack).
  const byService = new Map<string, EnrichedWorkflow[]>();
  for (const wf of workflows) {
    if (process.env.NODE_ENV === "development") {
      console.log("SYSTEM_MAP_DEBUG: workflow loaded", {
        workflowId: wf.id,
        provider: wf.tool,
        nodesCount: wf.graph?.nodes?.length,
      });
    }
    const services = getWorkflowServices(wf);
    if (process.env.NODE_ENV === "development") {
      console.log("SYSTEM_MAP_DEBUG: services extracted", {
        workflowId: wf.id,
        services,
      });
    }
    for (const service of services) {
      const list = byService.get(service) ?? [];
      list.push(wf);
      byService.set(service, list);
    }
  }

  const sortedServices = Array.from(byService.entries()).sort(
    (a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" })
  );

  if (sortedServices.length === 0) {
    return (
      <section>
        <SectionHeader title="System Map" accent="bg-indigo-400" />
        <div
          className="bg-white rounded-xl px-6 py-12 text-center"
          style={{ border: '1px solid rgba(0,0,0,0.07)' }}
        >
          <p className="text-[13px] text-gray-400">No services to show.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader
        title="System Map"
        accent="bg-indigo-400"
        count={`${sortedServices.length} service${sortedServices.length !== 1 ? "s" : ""}`}
      />
      <div className="grid grid-cols-3 gap-2.5">
        {sortedServices.map(([service, list]) => {
          const slug = nameToSlug(service);
          const icon = getDestinationStyles(service);
          return (
            <Link
              key={service}
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
                    <div className="text-[14px] text-gray-900">{formatServiceLabel(service)}</div>
                    <div className="text-[11px] text-gray-400">
                      {list.length} workflow{list.length !== 1 ? "s" : ""} · {getNodeCount(service, list)} node{getNodeCount(service, list) !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
                <ArrowRightIcon className="w-4 h-4 text-gray-200 group-hover:text-gray-400 transition-colors" />
              </div>
              {/* Workflow list */}
              <div className="px-5 pb-5">
                {list.map((wf, index) => {
                  const matchingNode = wf.graph?.nodes.find((n) => n.service === service);
                  const rawSummary = matchingNode?.aiSummary ?? wf.aiSummary;
                  const displayText = rawSummary?.trim().replace(/\.$/, "") ?? wf.name;
                  const isLast = index === list.length - 1;
                  return (
                    <div
                      key={wf.id}
                      className="flex items-center justify-between gap-2 py-[6px]"
                      style={!isLast ? { borderBottom: "0.5px solid rgba(0,0,0,0.05)" } : undefined}
                    >
                      <p className="text-[13px] text-gray-900 truncate">{displayText}</p>
                      <div className="shrink-0">
                        <Badge variant={wf.active ? "success" : "neutral"}>
                          {wf.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
