import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getN8nConnection } from "@/lib/n8n-connection";

export const dynamic = "force-dynamic";

export async function GET() {
  const conn = await getN8nConnection();

  if (!conn) {
    return NextResponse.json(
      { error: "n8n is not connected. Use the Connect n8n button first." },
      { status: 400 },
    );
  }

  const { connectionId, userId, credentials } = conn;

  try {
    const res = await fetch(`${credentials.baseUrl}/api/v1/workflows`, {
      headers: { "X-N8N-API-KEY": credentials.apiKey },
      cache: "no-store",
    });

    if (!res.ok) {
      // Log sync error
      await logSync(connectionId, userId, "ERROR", 0, `n8n responded ${res.status}`);
      return NextResponse.json(
        { error: `n8n API responded with status ${res.status}` },
        { status: res.status },
      );
    }

    const payload = await res.json();
    const n8nWorkflows: N8nWorkflow[] = payload.data ?? [];

    // ─── Sync workflows to DB ─────────────────────────────────────
    let synced = 0;
    for (const wf of n8nWorkflows) {
      const triggerNode = wf.nodes?.find((n: N8nNode) => {
        const t = n.type?.toLowerCase() ?? "";
        return t.includes("trigger") || t.includes("webhook");
      });

      const triggerConfig = triggerNode?.parameters
        ? (triggerNode.parameters as Prisma.InputJsonValue)
        : Prisma.JsonNull;
      const actions = {
        nodes: wf.nodes,
        connections: wf.connections,
      } as Prisma.InputJsonValue;

      await prisma.workflow.upsert({
        where: {
          connectionId_toolWorkflowId: {
            connectionId,
            toolWorkflowId: String(wf.id),
          },
        },
        update: {
          name: wf.name,
          status: wf.active ? "active" : "inactive",
          triggerType: triggerNode?.type ?? undefined,
          triggerConfig,
          actions,
          lastSyncedAt: new Date(),
        },
        create: {
          userId,
          connectionId,
          toolWorkflowId: String(wf.id),
          name: wf.name,
          status: wf.active ? "active" : "inactive",
          triggerType: triggerNode?.type ?? undefined,
          triggerConfig,
          actions,
          lastSyncedAt: new Date(),
        },
      });
      synced++;
    }

    // Update connection lastSyncedAt
    await prisma.connection.update({
      where: { id: connectionId },
      data: { lastSyncedAt: new Date() },
    });

    // Log successful sync
    await logSync(connectionId, userId, "SUCCESS", synced, null);

    return NextResponse.json(payload);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error calling n8n API";
    await logSync(connectionId, userId, "ERROR", 0, message).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function logSync(
  connectionId: string,
  userId: string,
  status: "SUCCESS" | "PARTIAL" | "ERROR",
  workflowsCount: number,
  errorMessage: string | null,
) {
  await prisma.syncLog.create({
    data: { connectionId, userId, status, workflowsCount, errorMessage },
  });
}

// Minimal types for the n8n API response
interface N8nNode {
  type: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

interface N8nWorkflow {
  id: string | number;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: Record<string, unknown>;
  [key: string]: unknown;
}
