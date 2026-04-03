import { cookies } from "next/headers";
import WorkflowDetailClient from "./WorkflowDetailClient";
import {
  getAllWorkflows,
  getAllWorkflowsAsRaw,
  getAllWorkflowsFromDatabase,
  getAllWorkflowsFromDatabaseAsRaw,
} from "@/lib/repositories/workflowsRepository";
import type { Workflow, WorkflowInsightData } from "@/lib/providers/types";
import { prisma } from "@/lib/prisma";
import {
  getEnrichmentForWorkflow,
  detectDuplicates,
  addIssuesToEnrichedWorkflows,
  type EnrichedIssue,
} from "@/lib/enrichment";
import { detectSignals, type WorkflowWithSignals } from "@/lib/signals/detectSignals";
import type { Signal } from "@/lib/signals/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function buildSignalsForWorkflow(
  workflowId: string,
  allWorkflows: Workflow[],
  allRaw: Awaited<ReturnType<typeof getAllWorkflowsFromDatabaseAsRaw>>,
): Promise<{ signals: Signal[]; issuesEnriched: EnrichedIssue[] }> {
  const enrichedBase = allRaw.map((w) => {
    const workflow = allWorkflows.find((wf) => wf.id === w.id);
    return {
      ...w,
      enrichment: getEnrichmentForWorkflow(w),
      graph: workflow?.graph,
    };
  });
  const { map: duplicateMap } = detectDuplicates(enrichedBase);
  const withIssues = addIssuesToEnrichedWorkflows(enrichedBase, duplicateMap);

  const withGraphs = withIssues.filter((wf) => {
    const g = (wf as { graph?: { nodes?: unknown[] } }).graph;
    return Array.isArray(g?.nodes) && (g!.nodes!.length > 0);
  });
  const prepared = withGraphs.map((wf) => ({
    ...wf,
    signals: [] as Signal[],
  })) as unknown as WorkflowWithSignals[];

  let withSignals: WorkflowWithSignals[] = prepared;
  try {
    withSignals = detectSignals(prepared);
  } catch {
    // If signal detection fails, proceed without signals
  }

  const thisWorkflow = withSignals.find((w) => w.id === workflowId);
  return {
    signals: thisWorkflow?.signals ?? [],
    issuesEnriched: thisWorkflow?.issuesEnriched ?? [],
  };
}

export default async function WorkflowDetailPage({ params }: PageProps) {
  const { id: workflowId } = await params;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get("demo_mode")?.value;
  const envDefault = process.env.DEMO_MODE === "true";
  const demoMode =
    typeof cookieValue === "string" ? cookieValue === "true" : envDefault;

  if (demoMode) {
    const allDemoWorkflows = getAllWorkflows();
    const workflow = allDemoWorkflows.find((w) => w.id === workflowId) ?? null;
    const allRaw = getAllWorkflowsAsRaw();
    const { signals, issuesEnriched } = await buildSignalsForWorkflow(workflowId, allDemoWorkflows, allRaw);
    return (
      <WorkflowDetailClient
        workflow={workflow}
        workflowId={workflowId}
        signals={signals}
        issuesEnriched={issuesEnriched}
      />
    );
  }

  const allWorkflows = await getAllWorkflowsFromDatabase();
  const allRaw = await getAllWorkflowsFromDatabaseAsRaw();
  const rawDbInsights = await prisma.workflowInsight.findMany({
    where: { workflowId },
    orderBy: { createdAt: "desc" },
  });
  const workflow = allWorkflows.find((w) => w.id === workflowId) ?? null;
  const { signals, issuesEnriched } = await buildSignalsForWorkflow(workflowId, allWorkflows, allRaw);

  const dbInsights: WorkflowInsightData[] = rawDbInsights.map((i) => ({
    id: i.id,
    type: i.type,
    severity: i.severity,
    title: i.title,
    description: i.description,
    fix: i.fix,
  }));

  return (
    <WorkflowDetailClient
      workflow={workflow}
      workflowId={workflowId}
      signals={signals}
      issuesEnriched={issuesEnriched}
      dbInsights={dbInsights}
    />
  );
}
