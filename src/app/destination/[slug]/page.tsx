"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
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

const DEST_COLORS: Record<string, { bg: string; text: string }> = {
  orange: { bg: "bg-orange-50", text: "text-orange-600" },
  violet: { bg: "bg-purple-50", text: "text-purple-600" },
  neutral: { bg: "bg-gray-100", text: "text-gray-800" },
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  emerald: { bg: "bg-green-50", text: "text-green-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-700" },
};

const NODE_STYLES: Record<
  PipelineNodeCategory,
  { border: string; bg: string; text: string; label: string }
> = {
  trigger: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    text: "text-blue-700",
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
    label: "Destination",
  },
  action: {
    border: "border-gray-200",
    bg: "bg-gray-50",
    text: "text-gray-700",
    label: "Action",
  },
};

const TOOL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  n8n: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100" },
  zapier: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
  make: { bg: "bg-violet-50", text: "text-violet-600", border: "border-violet-100" },
  airtable: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
};

function ToolBadge({ tool }: { tool: string }) {
  const s = TOOL_STYLES[tool] ?? { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-100" };
  return (
    <span className={`text-[10px] px-1.5 py-[2px] rounded border ${s.bg} ${s.text} ${s.border}`}>
      {tool}
    </span>
  );
}

function GraphNode({ node }: { node: PipelineNode }) {
  const style = NODE_STYLES[node.category];
  return (
    <div className="flex flex-col items-center shrink-0">
      <div className={`px-5 py-3 rounded-xl border ${style.bg} ${style.border} min-w-[120px] text-center transition-shadow hover:shadow-sm`}>
        <div className={`text-[13px] ${style.text}`}>{node.label}</div>
      </div>
      <span className="text-[10px] text-gray-400 mt-1.5">{style.label}</span>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex items-center shrink-0 -mt-5">
      <div className="w-8 h-px bg-gray-200" />
      <div className="w-0 h-0 border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent border-l-gray-300" />
    </div>
  );
}

function PipelineGraph({ nodes }: { nodes: PipelineNode[] }) {
  if (nodes.length === 0) return null;
  return (
    <div className="flex items-center gap-0 py-6 px-2 overflow-x-auto">
      {nodes.map((node, i) => (
        <div key={node.id} className="flex items-center">
          {i > 0 && <Connector />}
          <GraphNode node={node} />
        </div>
      ))}
    </div>
  );
}

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default function DestinationPage({ params, searchParams }: PageProps) {
  const resolved = use(params);
  use(searchParams ?? Promise.resolve({})); // unwrap to avoid sync access
  const slug = slugFromParam(resolved.slug);

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

  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  if (!meta && workflows.length === 0) {
    return (
      <div className="bg-[#fafafa] min-h-screen">
        <SidebarTools workflows={workflows} selectedTool={selectedTool} onSelectTool={setSelectedTool} />
        <div className="ml-[80px] px-8 py-6">
          <div className="max-w-[1360px] mx-auto">
            <button
              onClick={() => window.history.back()}
              className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors mb-4"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to dashboard
            </button>
            <h1 className="text-gray-900" style={{ fontSize: '20px', lineHeight: 1.3 }}>
              No workflows found
            </h1>
            <p className="mt-2 text-[12px] text-gray-500">
              No workflows write to this destination.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const destinationName = meta?.name ?? slug;
  const destColor = meta ? (DEST_COLORS[meta.accent] ?? { bg: "bg-gray-100", text: "text-gray-800" }) : { bg: "bg-gray-100", text: "text-gray-800" };

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <SidebarTools workflows={workflows} selectedTool={selectedTool} onSelectTool={setSelectedTool} />

      <div className="ml-[80px] px-8 py-6">
        <div className="max-w-[1360px] mx-auto">

          {/* Back button */}
          <Link
            href="/overview"
            className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors mb-4"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to dashboard
          </Link>

          {/* Title area */}
          <div className="flex items-center gap-3 mb-8">
            {meta && (
              <div className={`w-10 h-10 rounded-xl ${destColor.bg} flex items-center justify-center`}>
                <span className={`text-[11px] ${destColor.text}`}>{meta.abbrev}</span>
              </div>
            )}
            <div>
              <h1 className="text-gray-900" style={{ fontSize: '20px', lineHeight: 1.3 }}>
                {destinationName}
              </h1>
              <p className="text-[13px] text-gray-400">
                {workflows.length} workflow{workflows.length !== 1 ? "s" : ""} writing to this destination
              </p>
            </div>
          </div>

          {/* Workflow cards */}
          <div className="space-y-4">
            {workflows.map((wf, idx) => {
              const pipeline = getWorkflowPipeline(wf.graph, destinationName);
              const description = descriptions[idx] ?? wf.name;
              return (
                <div
                  key={wf.id}
                  className="bg-white rounded-xl transition-all duration-200 hover:shadow-sm"
                  style={{ border: '1px solid rgba(0,0,0,0.07)' }}
                >
                  {/* Card header */}
                  <div className="px-6 pt-5 pb-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <Link
                          href={`/workflows/${wf.id}`}
                          className="text-[14px] text-gray-900 hover:underline"
                        >
                          {wf.name}
                        </Link>
                        <p className="mt-0.5 text-[12px] text-gray-400">
                          {description}
                        </p>
                      </div>
                      <ToolBadge tool={wf.provider} />
                    </div>
                  </div>
                  {/* Pipeline graph */}
                  <div className="px-6 pb-5">
                    <PipelineGraph nodes={pipeline} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
