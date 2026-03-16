import { cookies } from "next/headers";
import WorkflowDetailClient from "./WorkflowDetailClient";
import { getWorkflowById, getWorkflowByIdFromDatabase } from "@/lib/repositories/workflowsRepository";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function WorkflowDetailPage({ params }: PageProps) {
  const { id: workflowId } = await params;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get("demo_mode")?.value;
  const envDefault = process.env.DEMO_MODE === "true";
  const demoMode =
    typeof cookieValue === "string" ? cookieValue === "true" : envDefault;

  const workflow = demoMode
    ? getWorkflowById(workflowId)
    : await getWorkflowByIdFromDatabase(workflowId);

  return (
    <WorkflowDetailClient workflow={workflow} workflowId={workflowId} />
  );
}
