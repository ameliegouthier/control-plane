"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { getAllWorkflows, getAllWorkflowsAsRaw } from "@/lib/repositories/workflowsRepository";
import { getEnrichmentForWorkflow } from "@/lib/enrichment";
import {
  buildMiniMap,
  getWorkflowRoute,
  type Workflow,
  type MiniMapNode,
} from "@/app/workflow-helpers";
import SidebarTools from "@/app/overview/components/SidebarTools";

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

function getNodeStyle(type: string) {
  const t = type.toLowerCase();
  if (t.includes("trigger") || t.includes("webhook")) return { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" };
  if (t.includes("condition") || t.includes("if") || t.includes("switch")) return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" };
  return { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700" };
}

function NodePill({ node }: { node: MiniMapNode }) {
  const style = getNodeStyle(node.type);
  return (
    <span className={`text-[10px] px-1.5 py-[2px] rounded border ${style.bg} ${style.text} ${style.border}`}>
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
          {i > 0 && <span className="text-gray-300">→</span>}
          <NodePill node={node} />
        </span>
      ))}
    </div>
  );
}

type PageProps = {
  params: Promise<{ destination: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default function DestinationPage({ params, searchParams }: PageProps) {
  const resolved = use(params);
  use(searchParams ?? Promise.resolve({})); // unwrap to avoid sync access
  const slug = typeof resolved.destination === "string" ? resolved.destination : "";
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

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
      <div className="bg-[#fafafa] min-h-screen">
        <SidebarTools selectedTool={selectedTool} onSelectTool={setSelectedTool} />
        <div className="ml-[80px] px-8 py-6">
          <div className="max-w-[1360px] mx-auto">
            <Link
              href="/overview"
              className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors mb-4"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to dashboard
            </Link>
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

  return (
    <div className="bg-[#fafafa] min-h-screen">
      <SidebarTools selectedTool={selectedTool} onSelectTool={setSelectedTool} />
      <div className="ml-[80px] px-8 py-6">
        <div className="max-w-[1360px] mx-auto">
          <Link
            href="/overview"
            className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition-colors mb-4"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to dashboard
          </Link>

          <h1 className="text-gray-900 mb-1" style={{ fontSize: '20px', lineHeight: 1.3 }}>
            {destinationName}
          </h1>
          <p className="text-[13px] text-gray-400">
            {workflows.length} workflow{workflows.length !== 1 ? "s" : ""} writing here
          </p>

          <div className="mt-8 space-y-4">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="bg-white rounded-xl transition-all duration-200 hover:shadow-sm"
                style={{ border: '1px solid rgba(0,0,0,0.07)' }}
              >
                <div className="px-5 pt-5 pb-3">
                  <Link
                    href={`/workflows/${wf.id}`}
                    className="text-[14px] text-gray-900 hover:underline"
                  >
                    {wf.name}
                  </Link>
                  <p className="mt-0.5 text-[12px] text-gray-400">
                    {getWorkflowRoute(wf.graph)}
                  </p>
                </div>
                <div className="px-5 pb-5">
                  <MiniPreview workflow={wf} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
