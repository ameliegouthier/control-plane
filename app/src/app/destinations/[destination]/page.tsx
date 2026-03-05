"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { getAllWorkflows, getAllWorkflowsAsRaw } from "@/lib/repositories/workflowsRepository";
import { getEnrichmentForWorkflow } from "@/lib/enrichment";
import {
  buildMiniMap,
  getWorkflowRoute,
  type Workflow,
  type MiniMapNode,
} from "@/app/workflow-helpers";

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function formatNodeType(type: string): string {
  const raw = type.includes(".") ? type.split(".").pop()! : type;
  const words = raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return words
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function NodePill({ node }: { node: MiniMapNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600">
      {node.label || formatNodeType(node.type)}
    </span>
  );
}

function MiniPreview({ workflow }: { workflow: Workflow }) {
  const { mainPath } = buildMiniMap(workflow.graph);
  if (mainPath.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {mainPath.map((node, i) => (
        <span key={node.name} className="flex items-center gap-1">
          {i > 0 && <span className="text-zinc-300">→</span>}
          <NodePill node={node} />
        </span>
      ))}
    </div>
  );
}

export default function DestinationPage() {
  const params = useParams();
  const slug = typeof params.destination === "string" ? params.destination : "";

  const { destinationName, workflows } = useMemo(() => {
    const rawList = getAllWorkflowsAsRaw();
    const fullList = getAllWorkflows();
    const enriched = rawList.map((raw) => {
      const wf = fullList.find((f) => f.id === raw.id);
      return {
        raw,
        workflow: wf ?? null,
        enrichment: getEnrichmentForWorkflow(raw),
      };
    });
    const matching = enriched.filter(
      (e) => e.workflow && slugify(e.enrichment.output) === slug
    );
    const name = matching[0]?.enrichment.output ?? slug;
    return {
      destinationName: name,
      workflows: matching
        .filter((m): m is typeof m & { workflow: Workflow } => m.workflow != null)
        .map((m) => m.workflow),
    };
  }, [slug]);

  if (workflows.length === 0) {
    return (
      <div className="min-h-screen bg-[#fafaf9]">
        <main className="mx-auto max-w-3xl px-6 py-12">
          <Link
            href="/overview"
            className="text-sm font-medium text-zinc-500 transition hover:text-zinc-700"
          >
            ← Back to Overview
          </Link>
          <h1 className="mt-6 text-xl font-semibold text-zinc-900">
            No workflows found
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            No workflows write to this destination.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf9]">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/overview"
          className="text-sm font-medium text-zinc-500 transition hover:text-zinc-700"
        >
          ← Back to Overview
        </Link>

        <h1 className="mt-6 text-2xl font-semibold text-zinc-900">
          {destinationName}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {workflows.length} workflow{workflows.length !== 1 ? "s" : ""} writing
          here
        </p>

        <ul className="mt-8 space-y-6">
          {workflows.map((wf) => (
            <li
              key={wf.id}
              className="rounded-xl border border-zinc-200 bg-white p-5"
            >
              <Link
                href={`/workflows/${wf.id}`}
                className="block font-medium text-zinc-900 hover:text-zinc-700"
              >
                {wf.name}
              </Link>
              <p className="mt-1 text-sm text-zinc-500">
                {getWorkflowRoute(wf.graph)}
              </p>
              <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/60 p-3">
                <MiniPreview workflow={wf} />
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
