import type { JSX } from "react";
import { cookies } from "next/headers";
import OverviewClient, { type OverviewClientProps } from "./OverviewClient";
import {
  getAllWorkflows,
  getAllWorkflowsAsRaw,
  getAllWorkflowsFromDatabase,
  getAllWorkflowsFromDatabaseAsRaw,
} from "@/lib/repositories/workflowsRepository";
import { getIntegrationsForOverview } from "@/lib/repositories/integrationsRepository";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get("demo_mode")?.value;
  const envDefault = process.env.DEMO_MODE === "true";

  const demoMode =
    typeof cookieValue === "string"
      ? cookieValue === "true"
      : envDefault;

  const [workflows, rawWorkflows, integrations] = demoMode
    ? [
        getAllWorkflows(),
        getAllWorkflowsAsRaw(),
        [] as { id: string; provider: string }[],
      ]
    : await Promise.all([
        getAllWorkflowsFromDatabase(),
        getAllWorkflowsFromDatabaseAsRaw(),
        getIntegrationsForOverview(),
      ]);

  const integrationIdsForSync = integrations.map((i) => i.id);

  const OverviewClientTyped = OverviewClient as unknown as (
    props: OverviewClientProps,
  ) => JSX.Element;

  return (
    <OverviewClientTyped
      rawWorkflows={rawWorkflows}
      workflows={workflows}
      initialDemoMode={demoMode}
      integrationIdsForSync={integrationIdsForSync}
    />
  );
}

