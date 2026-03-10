import type { JSX } from "react";
import { cookies } from "next/headers";
import OverviewClient, { type OverviewClientProps } from "./OverviewClient";
import {
  getAllWorkflows,
  getAllWorkflowsAsRaw,
  getAllWorkflowsFromDatabase,
  getAllWorkflowsFromDatabaseAsRaw,
} from "@/lib/repositories/workflowsRepository";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get("demo_mode")?.value;
  const envDefault = process.env.DEMO_MODE === "true";

  const demoMode =
    typeof cookieValue === "string"
      ? cookieValue === "true"
      : envDefault;

  const [workflows, rawWorkflows] = demoMode
    ? [getAllWorkflows(), getAllWorkflowsAsRaw()]
    : await Promise.all([
        getAllWorkflowsFromDatabase(),
        getAllWorkflowsFromDatabaseAsRaw(),
      ]);

  const OverviewClientTyped = OverviewClient as unknown as (
    props: OverviewClientProps,
  ) => JSX.Element;

  return <OverviewClientTyped rawWorkflows={rawWorkflows} workflows={workflows} initialDemoMode={demoMode} />;
}

