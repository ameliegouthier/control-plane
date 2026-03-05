"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import SidebarTools from "@/app/overview/components/SidebarTools";
import { getAllWorkflows, getAllWorkflowsAsRaw } from "@/lib/repositories/workflowsRepository";
import { getEnrichmentForWorkflow } from "@/lib/enrichment";
import { getDestinationBySlug } from "@/app/data/destinations";
import {
  getWorkflowPipeline,
  type Workflow,
  type PipelineNode,
  type PipelineNodeCategory,
} from "@/app/workflow-helpers";

function slugFromParam(p: string | string[] | undefined): string {
  return typeof p === "string" ? p : Array.isArray(p) ? p[0] ?? "" : "";
}

const CATEGORY_STYLES: Record<
  PipelineNodeCategory,
  { border: string; bg: string; label: string; text: string }
> = {
  trigger: {
    border: "border-sky-200",
    bg: "bg-sky-50",
    text: "text-sky-700",
    label: "Trigger",
  },
  condition: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
    label: "Condition",
  },
  destination: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    label: "Output",
  },
  action: {
    border: "border-neutral-200",
    bg: "bg-neutral-50",
    text: "text-neutral-700",
    label: "Action",
  },
};

function PipelineNodeCard({ node }: { node: PipelineNode }) {
  const style = CATEGORY_STYLES[node.category];
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${style.border} ${style.bg}`}
    >
      <div className={`text-sm font-medium ${style.text}`}>{node.label}</div>
      <div className="text-xs text-neutral-500">{style.label}</div>
    </div>
  );
}

function PipelineRow({ nodes }: { nodes: PipelineNode[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {nodes.map((node, i) => (
        <span key={node.id} className="flex items-center gap-2">
          {i > 0 && (
            <span className="text-neutral-300">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          )}
          <PipelineNodeCard node={node} />
        </span>
      ))}
    </div>
  );
}

function ToolBadge({ tool }: { tool: string }) {
  return (
    <span className="rounded-md border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
      {tool}
    </span>
  );
}

export default function DestinationPage() {
  const params = useParams();
  const slug = slugFromParam(params.slug);

  const { meta, workflows, descriptions } = useMemo(() => {
    const meta = getDestinationBySlug(slug);
    const rawList = getAllWorkflowsAsRaw();
    const fullList = getAllWorkflows();
    const enriched = rawList.map((raw) => {
      const wf = fullList.find((f) => f.id === raw.id);
      const enrichment = getEnrichmentForWorkflow(raw);
      return {
        raw,
        workflow: wf ?? null,
        enrichment,
      };
    });
    const destName = meta?.name ?? slug;
    const nameLower = destName.toLowerCase().replace(/\s+/g, "-");
    const matching = enriched.filter((e) => {
      const out = e.enrichment.output;
      const outSlug = out.toLowerCase().replace(/\s+/g, "-");
      return outSlug === nameLower || out === destName;
    });
    const workflowList = matching
      .filter((m): m is typeof m & { workflow: Workflow } => m.workflow != null)
      .map((m) => m.workflow);
    const descriptions = matching.map((m) => m.enrichment.output);
    return {
      meta,
      workflows: workflowList,
      descriptions,
    };
  }, [slug]);

  if (!meta && workflows.length === 0) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <main className="mx-auto max-w-3xl px-8 py-12">
          <Link
            href="/overview"
            className="text-sm font-medium text-neutral-500 transition hover:text-neutral-700"
          >
            ← Back to dashboard
          </Link>
          <h1 className="mt-6 text-xl font-semibold text-neutral-900">
            No workflows found
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            No workflows write to this destination.
          </p>
        </main>
      </div>
    );
  }

  const destinationName = meta?.name ?? slug;
  const accentClasses =
    meta &&
    {
      orange: "bg-orange-500 text-white",
      violet: "bg-violet-500 text-white",
      neutral: "bg-neutral-600 text-white",
      blue: "bg-blue-500 text-white",
      emerald: "bg-emerald-500 text-white",
      amber: "bg-amber-500 text-white",
    }[meta.accent];

  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <SidebarTools selectedTool={selectedTool} onSelectTool={setSelectedTool} />
      <main className="pl-20">
        <div className="mx-auto max-w-[1360px] px-8 py-10">
          <Link
            href="/overview"
            className="text-sm font-medium text-neutral-500 transition hover:text-neutral-700"
          >
            ← Back to dashboard
          </Link>

          <div className="mt-6 flex items-center gap-3">
            {meta && (
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${accentClasses ?? "bg-neutral-200 text-neutral-700"}`}
              >
                {meta.abbrev}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-semibold text-neutral-900">
                {destinationName}
              </h1>
              <p className="mt-0.5 text-sm text-neutral-500">
                {workflows.length} workflow{workflows.length !== 1 ? "s" : ""}{" "}
                writing to this destination
              </p>
            </div>
          </div>

          <ul className="mt-10 space-y-8">
            {workflows.map((wf, idx) => {
              const pipeline = getWorkflowPipeline(wf.graph, destinationName);
              const description = descriptions[idx] ?? wf.name;
              return (
                <li
                  key={wf.id}
                  className="rounded-lg border border-neutral-200 bg-white p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link
                        href={`/workflows/${wf.id}`}
                        className="text-lg font-medium text-neutral-900 hover:text-neutral-700"
                      >
                        {wf.name}
                      </Link>
                      <p className="mt-1 text-sm text-neutral-500">
                        {description}
                      </p>
                    </div>
                    <ToolBadge tool={wf.provider} />
                  </div>
                  <div className="mt-4">
                    <PipelineRow nodes={pipeline} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
