import { prisma } from "./prisma";
import { getDemoUser } from "./demo-user";
import { decrypt } from "./crypto";

export interface N8nCredentials {
  baseUrl: string;
  apiKey: string;
}

export interface N8nConnectionInfo {
  connectionId: string;
  userId: string;
  credentials: N8nCredentials;
}

/**
 * Load the active n8n connection from DB for the current user.
 * Returns credentials + IDs needed for syncing workflows.
 * Returns null if no valid active connection exists.
 *
 * TODO: Replace getDemoUser() with authenticated session user.
 */
export async function getN8nConnection(): Promise<N8nConnectionInfo | null> {
  const user = await getDemoUser();

  const connection = await prisma.connection.findUnique({
    where: { userId_tool: { userId: user.id, tool: "N8N" } },
  });

  if (!connection || connection.status !== "ACTIVE" || !connection.config) {
    return null;
  }

  const config = connection.config as Record<string, string>;
  if (!config.baseUrl || !config.encryptedApiKey) {
    return null;
  }

  try {
    return {
      connectionId: connection.id,
      userId: user.id,
      credentials: {
        baseUrl: config.baseUrl,
        apiKey: decrypt(config.encryptedApiKey),
      },
    };
  } catch {
    return null;
  }
}

/** Shorthand — returns just the credentials (backward compat) */
export async function getN8nCredentials(): Promise<N8nCredentials | null> {
  const info = await getN8nConnection();
  return info?.credentials ?? null;
}
