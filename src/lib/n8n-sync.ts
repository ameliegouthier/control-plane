import { prisma } from "./prisma";
import { getProviderConnection } from "./provider-connection";
import { getProviderAdapter } from "./providers";
import type { ProviderConnection } from "./providers/types";

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
 * This function now uses the N8NAdapter through the provider abstraction layer.
 * The adapter handles:
 *   - Fetching workflows from n8n API
 *   - Normalizing them into the generic Workflow model
 *   - Syncing them to the database
 *
 * Can be called from:
 *   - Server component (page.tsx) during render
 *   - API route (GET /api/n8n/workflows) for explicit sync
 */
export async function syncN8nWorkflows(): Promise<SyncResult> {
  const conn = await getProviderConnection("n8n");

  if (!conn) {
    return { success: false, synced: 0, error: "n8n is not connected" };
  }

  // Convert to ProviderConnection format
  const connection: ProviderConnection = {
    id: conn.connectionId,
    provider: "n8n",
    userId: conn.userId,
    status: "ACTIVE",
    config: conn.config,
  };

  // Get the n8n adapter and sync workflows
  const adapter = getProviderAdapter("n8n");
  const result = await adapter.syncWorkflows(connection) as SyncResult & { rawPayload?: unknown };

  return {
    success: result.success,
    synced: result.synced,
    error: result.error,
    rawPayload: result.rawPayload,
  };
}
