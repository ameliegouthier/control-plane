"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useProviderFilter } from "@/hooks/useProviderFilter";
import type { Workflow } from "@/app/workflow-helpers";
import type { DestinationMeta } from "@/app/data/destinations";
import { Badge, ExternalLinkIcon, EmptyState, ToolBadge } from "@/components/ui";

const DEST_COLORS: Record<string, { bg: string; text: string }> = {
  orange: { bg: "bg-orange-50", text: "text-orange-600" },
  violet: { bg: "bg-purple-50", text: "text-purple-600" },
  neutral: { bg: "bg-gray-100", text: "text-gray-800" },
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  emerald: { bg: "bg-green-50", text: "text-green-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-700" },
};


/** Maps a technical action string to a human-readable label. */
function toReadableAction(action?: string): string {
  if (!action) return "Opération";
  const a = action.toLowerCase();
  if (a.includes("write") || a.includes("update") || a.includes("set")) return "Modifie des données";
  if (a.includes("create") || a.includes("insert") || a.includes("add")) return "Crée un nouveau record";
  if (a.includes("delete") || a.includes("remove")) return "Supprime un record";
  if (a.includes("read") || a.includes("get") || a.includes("list") || a.includes("search")) return "Lit des données";
  if (a.includes("send")) return "Envoie un message";
  if (a.includes("trigger") || a.includes("webhook")) return "Déclenche une action";
  // Fallback: clean and capitalize
  return action
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export interface DestinationMutation {
  workflowId: string;
  workflowName: string;
  workflowProvider: string;
  workflowActive: boolean;
  workflowAiSummary?: string | null;
  problemSolved?: string;
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
                {filteredMutations.length} workflow{filteredMutations.length !== 1 ? "s" : ""} modifient des données {destinationName}
              </p>
            </div>
          </div>

          {/* Empty state */}
          {filteredMutations.length === 0 ? (
            <EmptyState message="No operations found for this service" />
          ) : (
            /* Mutation cards */
            <div className="space-y-3">
              {filteredMutations.map((m) => {
                const readableAction = toReadableAction(m.action);
                const description = m.problemSolved && m.problemSolved !== "—"
                  ? m.problemSolved
                  : `Workflow ${m.workflowName} — ${readableAction} dans ${m.service}`;
                const statusVariant = m.workflowActive ? "success" : "neutral";
                const statusLabel = m.workflowActive ? "Active" : "Inactive";

                const rawSummary = m.workflowAiSummary?.trim().replace(/\.$/, "");
                const displayText = rawSummary ?? m.workflowName;
                const subtitle = `${readableAction} · ${m.workflowName}`;

                return (
                  <div
                    key={m.nodeId}
                    className="bg-white rounded-xl transition-all duration-200 hover:shadow-sm"
                    style={{ border: "1px solid rgba(0,0,0,0.07)" }}
                  >
                    <div className="px-5 py-4">
                      {/* Top row: provider badge + status */}
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[#0f172a] truncate">{displayText}</p>
                          <p className="text-[11px] text-gray-400 truncate mt-0.5">{subtitle}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <ToolBadge tool={m.workflowProvider} />
                          <Badge variant={statusVariant}>{statusLabel}</Badge>
                          <Link
                            href={`/workflows/${m.workflowId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-300 hover:text-gray-600 transition-colors"
                            aria-label={`Open workflow ${m.workflowName}`}
                          >
                            <ExternalLinkIcon className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
