import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getN8nConnection } from "./n8n-connection";
import { fetchN8nApi } from "./n8n-client";

// Minimal types for the n8n API response
interface N8nNode {
  type: string;
  name?: string;
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

export interface SyncResult {
  success: boolean;
  synced: number;
  error?: string;
  /** The raw n8n API payload (for the API route to return). */
  rawPayload?: unknown;
}

/**
 * Fetch workflows from the connected n8n instance and sync them into the DB.
 * Returns a SyncResult indicating success/failure and count.
 *
 * Uses fetchN8nApi which handles:
 *   - API key auth (X-N8N-API-KEY on /api/v1/*)
 *   - Login-based auth (POST /rest/login → session cookie on /rest/*)
 *   - ngrok header bypass
 *
 * Can be called from:
 *   - Server component (page.tsx) during render
 *   - API route (GET /api/n8n/workflows) for explicit sync
 */
export async function syncN8nWorkflows(): Promise<SyncResult> {
  const conn = await getN8nConnection();

  if (!conn) {
    return { success: false, synced: 0, error: "n8n is not connected" };
  }

  const { connectionId, userId, credentials } = conn;

  try {
    const res = await fetchN8nApi(credentials, "/workflows");

    if (!res.ok) {
      const msg = `n8n responded with status ${res.status}`;
      await logSync(connectionId, userId, "ERROR", 0, msg);
      return { success: false, synced: 0, error: msg };
    }

    const payload = await res.json();
    const n8nWorkflows: N8nWorkflow[] = payload.data ?? [];

    // ─── Sync workflows to DB ──────────────────────────────────────
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

    await logSync(connectionId, userId, "SUCCESS", synced, null);

    return { success: true, synced, rawPayload: payload };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error calling n8n API";
    await logSync(connectionId, userId, "ERROR", 0, message).catch(() => {});
    return { success: false, synced: 0, error: message };
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
