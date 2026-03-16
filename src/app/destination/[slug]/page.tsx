import { cookies } from "next/headers";
import { getAllWorkflows, getAllWorkflowsFromDatabase } from "@/lib/repositories/workflowsRepository";
import { getDestinationBySlug } from "@/app/data/destinations";
import type { Workflow } from "@/app/workflow-helpers";
import DestinationClient, { type DestinationMutation } from "./DestinationClient";

export const dynamic = "force-dynamic";

function slugFromParam(p: string | string[] | undefined): string {
  return typeof p === "string" ? p : Array.isArray(p) ? p[0] ?? "" : "";
}

function normalizeService(service: string | undefined | null): string {
  if (!service) return "";
  return service.toLowerCase().replace(/\s+/g, "-");
}

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function DestinationPage({ params }: PageProps) {
  const resolved = await params;
  const slug = slugFromParam(resolved.slug);

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get("demo_mode")?.value;
  const envDefault = process.env.DEMO_MODE === "true";

  const demoMode =
    typeof cookieValue === "string"
      ? cookieValue === "true"
      : envDefault;

  const workflows = demoMode
    ? getAllWorkflows()
    : await getAllWorkflowsFromDatabase();

  const meta = getDestinationBySlug(slug);
  const destinationName = meta?.name ?? slug;
  const destSlugNorm = slug.toLowerCase();

  const mutations: DestinationMutation[] = [];

  for (const wf of workflows) {
    const nodes = wf.graph?.nodes ?? [];
    for (const node of nodes) {
      const serviceRaw = node.service ?? "";
      const serviceNorm = normalizeService(serviceRaw);
      if (!serviceNorm || serviceNorm !== destSlugNorm) continue;
      // Include all nodes for this service (explicit and inferred actions)
      mutations.push({
        workflowId: wf.id,
        workflowName: wf.name,
        workflowProvider: wf.provider,
        nodeId: node.id,
        service: serviceRaw,
        action: node.action ?? node.operation ?? "",
        label: node.label,
      });
    }
  }

  // Workflows used only for the sidebar tools list.
  const workflowById = new Map<string, Workflow>(workflows.map((w) => [w.id, w]));
  const workflowsForSidebar = Array.from(
    new Set(mutations.map((m) => m.workflowId))
  )
    .map((id) => workflowById.get(id))
    .filter((wf): wf is Workflow => wf != null);

  return (
    <DestinationClient
      meta={meta ?? null}
      mutations={mutations}
      workflowsForSidebar={workflowsForSidebar}
      destinationName={destinationName}
    />
  );
}
