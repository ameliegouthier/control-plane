import React from "react";
import Dashboard from "./dashboard";
import { type Workflow, toWorkflow } from "./workflow-helpers";
import { getN8nConnection } from "@/lib/n8n-connection";
import { getDemoUser } from "@/lib/demo-user";
import { prisma } from "@/lib/prisma";
import { syncN8nWorkflows } from "@/lib/n8n-sync";

// Force Next.js to treat this page as fully dynamic (no SSG/cache)
export const dynamic = "force-dynamic";

export default async function Home() {
  let workflows: Workflow[] = [];
  let error: string | null = null;
  let n8nConnected = false;

  // 1. Check if n8n connection exists in DB (direct DB call — no HTTP self-fetch)
  try {
    const conn = await getN8nConnection();
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
        orderBy: { updatedAt: "desc" },
      });

      workflows = dbWorkflows.map(toWorkflow);
    } catch (e: unknown) {
      console.error("[page] workflow read failed:", e);
      error = e instanceof Error ? e.message : "Could not load workflows";
    }
  }

  return (
    <Dashboard
      workflows={workflows}
      error={error}
      initialN8nConnected={n8nConnected}
    />
  );
}
