"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useProviderFilter } from "@/hooks/useProviderFilter";
import type { Workflow } from "@/app/workflow-helpers";
import type { DestinationMeta } from "@/app/data/destinations";

const DEST_COLORS: Record<string, { bg: string; text: string }> = {
  orange: { bg: "bg-orange-50", text: "text-orange-600" },
  violet: { bg: "bg-purple-50", text: "text-purple-600" },
  neutral: { bg: "bg-gray-100", text: "text-gray-800" },
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  emerald: { bg: "bg-green-50", text: "text-green-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-700" },
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

export interface DestinationMutation {
  workflowId: string;
  workflowName: string;
  workflowProvider: string;
  nodeId: string;
  service: string;
  action?: string;
  label: string;
}

export interface DestinationClientProps {
  meta: DestinationMeta | null;
  mutations: DestinationMutation[];
  workflowsForSidebar: Workflow[];
  destinationName: string;
}

export default function DestinationClient({
  meta,
  mutations,
  workflowsForSidebar,
  destinationName,
}: DestinationClientProps) {
  const { setWorkflows, filterByProviders } = useProviderFilter();

  useEffect(() => {
    setWorkflows(workflowsForSidebar);
  }, [workflowsForSidebar, setWorkflows]);

  const filteredMutations = useMemo(() => {
    const mutationsWithProvider = mutations.map((m) => ({
      ...m,
      provider: m.workflowProvider,
    }));
    return filterByProviders(mutationsWithProvider);
  }, [mutations, filterByProviders]);

  if (!meta && mutations.length === 0) {
    return (
      <div className="bg-[#fafafa] min-h-screen">
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
            <h1 className="text-gray-900" style={{ fontSize: "20px", lineHeight: 1.3 }}>
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

  const destColor = meta ? (DEST_COLORS[meta.accent] ?? { bg: "bg-gray-100", text: "text-gray-800" }) : { bg: "bg-gray-100", text: "text-gray-800" };

  return (
    <div className="bg-[#fafafa] min-h-screen">
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
              <h1 className="text-gray-900" style={{ fontSize: "20px", lineHeight: 1.3 }}>
                {destinationName}
              </h1>
              <p className="text-[13px] text-gray-400">
                {filteredMutations.length} mutation{filteredMutations.length !== 1 ? "s" : ""} writing to this destination
              </p>
            </div>
          </div>

          {/* Mutation cards */}
          <div className="space-y-4">
            {filteredMutations.map((m) => {
              const primary = m.action ? `${m.service}:${m.action}` : m.service;
              return (
                <div
                  key={m.nodeId}
                  className="bg-white rounded-xl transition-all duration-200 hover:shadow-sm"
                  style={{ border: "1px solid rgba(0,0,0,0.07)" }}
                >
                  {/* Card header */}
                  <div className="px-6 pt-5 pb-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[14px] text-gray-900">
                          {primary}
                        </div>
                        <p className="mt-0.5 text-[12px] text-gray-400">
                          {m.label} · from{" "}
                          <Link
                            href={`/workflows/${m.workflowId}`}
                            className="hover:underline"
                          >
                            {m.workflowName}
                          </Link>
                        </p>
                      </div>
                      <ToolBadge tool={m.workflowProvider} />
                    </div>
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

