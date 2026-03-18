import type { JSX } from "react";
import { headers } from "next/headers";

import {
  getAllWorkflowsFromDatabase,
  getAllWorkflowsFromDatabaseAsRaw,
} from "@/lib/repositories/workflowsRepository";
import {
  getEnrichmentForWorkflow,
  type RawWorkflow,
  type WorkflowWithEnrichment,
  type WorkflowWithFullEnrichment,
  detectDuplicates,
  addIssuesToEnrichedWorkflows,
} from "@/lib/enrichment";
import type { WorkflowWithSignals } from "@/lib/signals/types";
import { detectSignals } from "@/lib/signals/signalEngine";
import type { Workflow } from "@/app/workflow-helpers";
import { buildSystemGraph } from "@/lib/system/systemGraph";
import { runWorkflowAdvisor, type AIAdvisorWorkflowInput } from "@/lib/ai/aiAdvisor";
import { prisma } from "@/lib/prisma";
import {
  DebugWorkflowsView,
  type DebugSectionPayload,
  type DebugWorkflowPayload,
  type OptimizationActionPayload,
} from "./DebugWorkflowsView";

export const dynamic = "force-dynamic";

type DebugItem = {
  workflow: Workflow;
  rawWorkflow: RawWorkflow | null;
  enrichment: ReturnType<typeof getEnrichmentForWorkflow> | null;
};

type DebugData = {
  label: string;
  items: DebugItem[];
  fullById: Map<string, WorkflowWithSignals>;
  optimizationActions: {
    id: string;
    name: string;
    severity: number;
    topIssue: WorkflowWithSignals["issuesEnriched"][number] | null;
  }[];
};

function buildDebugData(
  label: string,
  workflows: Workflow[],
  rawWorkflows: RawWorkflow[],
): DebugData {
  const rawById = new Map<string, RawWorkflow>(
    rawWorkflows.map((rw) => [rw.id, rw]),
  );

  const items: DebugItem[] = workflows.map((wf) => {
    const raw = rawById.get(wf.id) ?? null;
    const enrichment = raw ? getEnrichmentForWorkflow(raw) : null;
    return { workflow: wf, rawWorkflow: raw, enrichment };
  });

  const enrichedInput: WorkflowWithEnrichment[] = items
    .filter((i) => i.rawWorkflow && i.enrichment)
    .map((i) => ({
      ...(i.rawWorkflow as RawWorkflow),
      enrichment: i.enrichment!,
    }));

  const { map: duplicateMap } = detectDuplicates(enrichedInput);
  const fullEnrichedList: WorkflowWithFullEnrichment[] =
    addIssuesToEnrichedWorkflows(enrichedInput, duplicateMap);
  const idToProvider = new Map(
    items
      .filter((i) => i.rawWorkflow)
      .map((i) => [i.rawWorkflow!.id, i.workflow.provider]),
  );

  // Merge normalized workflows (with graph) into enriched data before signal detection.
  // Signal detection requires workflow.graph.nodes/edges; raw workflows only have nodes.
  const workflowsForSignals: WorkflowWithSignals[] = fullEnrichedList.map(
    (wf) => {
      const normalized = workflows.find((w) => w.id === wf.id);
      const graph = normalized?.graph ?? { nodes: [], edges: [] };
      return {
        ...normalized,
        ...wf,
        graph,
        signals: [] as WorkflowWithSignals["signals"],
      } as WorkflowWithSignals;
    },
  );

  const validForSignals = workflowsForSignals.filter((wf) => {
    if (!Array.isArray(wf.graph?.nodes) || wf.graph.nodes.length === 0) {
      if (process.env.NODE_ENV === "development") {
        throw new Error(
          `Workflow ${wf.id} not normalized before signal detection`,
        );
      }
      return false;
    }
    return true;
  });

  const withSignalsFromDetection = detectSignals(validForSignals, {
    idToProvider,
  });

  const filteredOut = workflowsForSignals.filter(
    (wf) => !validForSignals.includes(wf),
  );
  const fullWithSignals: WorkflowWithSignals[] = [
    ...withSignalsFromDetection,
    ...filteredOut.map((wf) => ({
      ...wf,
      signals: [] as WorkflowWithSignals["signals"],
      signalSummary: "clean-workflow" as const,
    })),
  ];
  const fullById = new Map<string, WorkflowWithSignals>(
    fullWithSignals.map((wf) => [wf.id, wf]),
  );

  const enrichmentById = new Map<
    string,
    ReturnType<typeof getEnrichmentForWorkflow>
  >();
  for (const item of items) {
    if (item.rawWorkflow && item.enrichment) {
      enrichmentById.set(item.rawWorkflow.id, item.enrichment);
    }
  }

  const optimizationActions = fullWithSignals
    .map((wf) => {
      const enrichment = enrichmentById.get(wf.id);
      if (!enrichment) return null;
      const hasOptimization = wf.hasOptimization;
      const isBroken = enrichment.health === "broken";
      if (!hasOptimization || isBroken) return null;
      const topIssue =
        wf.issuesEnriched.find((i) => i.category === "optimization") ??
        wf.issuesEnriched[0] ??
        null;
      const normalized = workflows.find((w) => w.id === wf.id);
      return {
        id: wf.id,
        name: normalized?.name ?? wf.name,
        severity: wf.severity,
        topIssue,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.severity - a.severity);

  return { label, items, fullById, optimizationActions };
}

/** Build serializable payload for the debug view (no Maps, no non-JSON). */
function buildPayload(
  sections: DebugData[],
): {
  sections: DebugSectionPayload[];
  optimizationActions: OptimizationActionPayload[];
} {
  const sectionPayloads: DebugSectionPayload[] = sections.map((section) => {
    const workflows: DebugWorkflowPayload[] = section.items.map((item) => {
      const raw = item.rawWorkflow;
      const full = raw ? section.fullById.get(raw.id) : null;
      const enrichment = item.enrichment;
      const nodeCount = raw
        ? raw.nodesCount ?? (Array.isArray(raw.nodes) ? raw.nodes.length : 0)
        : item.workflow.graph?.nodes.length ?? 0;

      const issues = full
        ? full.issuesEnriched.map((issue) => ({
            type: issue.type,
            severity: issue.severity,
            description: issue.copy.impact,
          }))
        : [];

      const technical =
        full && raw && enrichment
          ? (() => {
              const hasOptimization = full.hasOptimization;
              const isBroken = enrichment.health === "broken";
              const isFiltered = !hasOptimization || isBroken;
              let filterReason: string | undefined;
              if (isFiltered) {
                filterReason = hasOptimization
                  ? 'Filtered: health === "broken"'
                  : "Filtered: no optimization issues";
              } else {
                filterReason = "Included in optimization list";
              }
              return {
                workflowId: full.id,
                triggerType: raw.triggerType,
                graphNodes: item.workflow.graph?.nodes?.map((n) => ({
                  id: n.id,
                  label: n.label,
                  provider: n.provider,
                  service: n.service,
                  operation: n.operation ?? (n as { action?: string }).action,
                })),
                enrichment: {
                  domain: enrichment.domain,
                  systems: enrichment.systems,
                  output: enrichment.output,
                  health: enrichment.health,
                  riskFlags: enrichment.riskFlags,
                },
                rawIssues: full.issues.map((i) => ({ type: i.type })),
                enrichedIssues: full.issuesEnriched.map((i) => ({
                  type: i.type,
                  category: i.category,
                  severity: i.severity,
                  impact: i.copy.impact,
                  recommendedAction: i.copy.recommendedAction,
                })),
                severity: full.severity,
                category: full.category,
                hasBroken: full.hasBroken,
                hasSecurity: full.hasSecurity,
                hasOptimization: full.hasOptimization,
                topIssueType: full.topIssueType,
                topRecommendedAction: full.topRecommendedAction ?? undefined,
                health: enrichment.health,
                isFilteredFromOptimizationList: isFiltered,
                filterReason,
              };
            })()
          : undefined;

      return {
        workflowId: item.workflow.id,
        name: raw?.name ?? item.workflow.name,
        provider: item.workflow.provider,
        active: raw?.active ?? item.workflow.active,
        nodesCount: nodeCount,
        signalSummary: full?.signalSummary,
        signals: full?.signals?.map((s) => ({ type: s.type, category: s.category })) ?? [],
        issues,
        technical,
      };
    });

    return { label: section.label, workflows };
  });

  const optimizationActions: OptimizationActionPayload[] = sections.flatMap(
    (s) =>
      s.optimizationActions.map((a) => ({
        id: a.id,
        name: a.name,
        severity: a.severity,
        issueType: a.topIssue?.type ?? "optimization",
        suggestion: a.topIssue?.copy.recommendedAction ?? "Review workflow",
      })),
  );

  return { sections: sectionPayloads, optimizationActions };
}

export default async function DebugWorkflowsPage(): Promise<JSX.Element> {
  const [liveWorkflows, liveRawWorkflows] = await Promise.all([
    getAllWorkflowsFromDatabase(),
    getAllWorkflowsFromDatabaseAsRaw(),
  ]);

  const liveDebug = buildDebugData(
    "LIVE WORKFLOWS",
    liveWorkflows,
    liveRawWorkflows,
  );

  const systemGraph = buildSystemGraph(liveWorkflows);
  console.log("SYSTEM_GRAPH_DEBUG", {
    services: Array.from(systemGraph.services.values()).map((s) => ({
      service: s.service,
      workflows: Array.from(s.workflows),
    })),
    edges: systemGraph.edges,
  });

  // Per-workflow AI advisor: set AI_OPTIMIZATION_AGENT_ENABLED=true to run.
  if (process.env.AI_OPTIMIZATION_AGENT_ENABLED === "true") {
    const headersList = await headers();
    const host = headersList.get("host") ?? "localhost:3000";
    const protocol =
      headersList.get("x-forwarded-proto") ||
      (host.includes("localhost") ? "http" : "https");
    const baseUrl = `${protocol}://${host}`;

    const activeWorkflows = liveWorkflows.filter((wf) => wf.active);

    for (const wf of activeWorkflows) {
      const nodes: AIAdvisorWorkflowInput["nodes"] = (wf.graph?.nodes ?? []).map((n) => ({
        service: (n.service as string | undefined) ?? (n.label as string | undefined) ?? "",
        operation: ((n as { operation?: string }).operation ?? (n as { action?: string }).action) ?? "",
        kind: (n.type as string | undefined) ?? "action",
      }));

      const wfWithSignals = liveDebug.fullById.get(wf.id);
      const signals = (wfWithSignals?.signals ?? []).map((s) => s.type);

      const input: AIAdvisorWorkflowInput = {
        workflowId: wf.id,
        workflowName: wf.name,
        nodes,
        signals,
      };

      try {
        const insights = await runWorkflowAdvisor(input, { baseUrl });
        if (insights.length > 0) {
          await prisma.workflowInsight.deleteMany({ where: { workflowId: wf.id } });
          await prisma.workflowInsight.createMany({
            data: insights.map((i) => ({
              workflowId: wf.id,
              type: i.type,
              severity: i.severity,
              title: i.title,
              description: i.description ?? null,
              fix: i.fix ?? null,
            })),
          });
          console.log(`AI_ADVISOR: saved ${insights.length} insights for workflow ${wf.id}`);
        }
      } catch (err) {
        console.error(`AI_ADVISOR: failed for workflow ${wf.id}`, err);
      }
    }
  }

  const { sections: sectionPayloads, optimizationActions } =
    buildPayload([liveDebug]);

  const dbInsights = await prisma.workflowInsight.findMany({
    select: { workflowId: true, type: true, severity: true, title: true, description: true, fix: true },
  });

  return (
    <DebugWorkflowsView
      sections={sectionPayloads}
      optimizationActions={optimizationActions}
      workflowInsights={dbInsights}
    />
  );
}
