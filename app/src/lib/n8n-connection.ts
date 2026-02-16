import { prisma } from "./prisma";
import { getDemoUser } from "./demo-user";
import type { N8nCredentials } from "./n8n-client";

export type { N8nCredentials };

export interface N8nConnectionInfo {
  connectionId: string;
  userId: string;
  credentials: N8nCredentials;
}

/**
 * Load the active n8n connection from DB for the current user.
 * MVP: no auth secrets — just baseUrl + apiPath.
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
  if (!config.baseUrl) return null;

  return {
    connectionId: connection.id,
    userId: user.id,
    credentials: {
      baseUrl: config.baseUrl,
      apiPath: config.apiPath ?? "/rest",
    },
  };
}

/** Shorthand — returns just the credentials. */
export async function getN8nCredentials(): Promise<N8nCredentials | null> {
  const info = await getN8nConnection();
  return info?.credentials ?? null;
}
