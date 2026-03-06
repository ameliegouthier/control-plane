import React from "react";
import Dashboard from "./dashboard";
import { type Workflow, toWorkflow } from "./workflow-helpers";
import { getProviderConnection } from "@/lib/provider-connection";
import { getDemoUser } from "@/lib/demo-user";
import { prisma } from "@/lib/prisma";
import { syncN8nWorkflows } from "@/lib/n8n-sync";
import { getAllWorkflows } from "@/lib/repositories/workflowsRepository";

// Force Next.js to treat this page as fully dynamic (no SSG/cache)
export const dynamic = "force-dynamic";

const isServerDemoMode = process.env.DEMO_MODE === "true";

export default async function Home() {
  // ─── Server-side demo mode: skip DB/n8n entirely ─────────────
  if (isServerDemoMode) {
    const demoWorkflows = getAllWorkflows();
    console.log("WORKFLOWS (DEMO MODE):", demoWorkflows);
    return (
      <Dashboard
        workflows={demoWorkflows}
        error={null}
        initialN8nConnected={false}
        initialDemoMode
      />
    );
  }

  let workflows: Workflow[] = [];
  let error: string | null = null;
  let n8nConnected = false;

  // 1. Check if n8n connection exists in DB (direct DB call — no HTTP self-fetch)
  try {
    const conn = await getProviderConnection("n8n");
    n8nConnected = !!conn;
  } catch (err) {
    console.error("[page] connection check failed:", err);
  }

  // 2. If connected, sync from n8n then read from DB
  if (n8nConnected) {
    // 2a. Trigger sync (n8n → DB) — calls n8n API directly, no self-fetch
    try {
      const syncResult = await syncN8nWorkflows();
      if (!syncResult.success) {
        console.warn("[page] sync warning:", syncResult.error);
      }
    } catch (syncErr) {
      console.error("[page] sync call failed:", syncErr);
    }

    // 2b. Read workflows from DB (source of truth)
    try {
      const user = await getDemoUser();

      const dbWorkflows = await prisma.workflow.findMany({
        where: { userId: user.id },
        include: { connection: true }, // Include connection to get provider info
        orderBy: { updatedAt: "desc" },
      });

      workflows = dbWorkflows.map(toWorkflow);
    } catch (e: unknown) {
      console.error("[page] workflow read failed:", e);
      error = e instanceof Error ? e.message : "Could not load workflows";
    }
  }

  console.log("WORKFLOWS:", workflows);

  return (
    <Dashboard
      workflows={workflows}
      error={error}
      initialN8nConnected={n8nConnected}
    />
  );
}
