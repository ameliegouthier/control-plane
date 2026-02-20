import { prisma } from "./prisma";
import { getDemoUser } from "./demo-user";
import type { AutomationProvider } from "./providers/types";
import type { N8nCredentials } from "./n8n-client";

export type { N8nCredentials };

export interface ProviderConnectionInfo {
  connectionId: string;
  userId: string;
  provider: AutomationProvider;
  config: Record<string, unknown>;
}

/**
 * Map AutomationProvider to Prisma ToolType enum.
 */
function mapProviderToToolType(provider: AutomationProvider): "N8N" | "MAKE" | "ZAPIER" | "AIRTABLE" {
  switch (provider) {
    case "n8n":
      return "N8N";
    case "make":
      return "MAKE";
    case "zapier":
      return "ZAPIER";
    case "airtable":
      return "AIRTABLE";
  }
}

/**
 * Load the active connection for a specific provider from DB for the current user.
 * Generic version that works for any provider.
 */
export async function getProviderConnection(
  provider: AutomationProvider
): Promise<ProviderConnectionInfo | null> {
  const user = await getDemoUser();
  const tool = mapProviderToToolType(provider);

  const connection = await prisma.connection.findUnique({
    where: { userId_tool: { userId: user.id, tool } },
  });

  if (!connection || connection.status !== "ACTIVE" || !connection.config) {
    return null;
  }

  const config = connection.config as Record<string, unknown>;
  if (!config.baseUrl) return null;

  return {
    connectionId: connection.id,
    userId: user.id,
    provider,
    config,
  };
}

/**
 * Check if a provider is connected.
 */
export async function isProviderConnected(provider: AutomationProvider): Promise<boolean> {
  const conn = await getProviderConnection(provider);
  return !!conn;
}

// ─── Legacy n8n-specific functions (for backward compatibility) ────────────────

export interface N8nConnectionInfo {
  connectionId: string;
  userId: string;
  credentials: N8nCredentials;
}

/**
 * @deprecated Use getProviderConnection("n8n") instead
 * Load the active n8n connection from DB for the current user.
 */
export async function getN8nConnection(): Promise<N8nConnectionInfo | null> {
  const conn = await getProviderConnection("n8n");
  if (!conn) return null;

  return {
    connectionId: conn.connectionId,
    userId: conn.userId,
    credentials: {
      baseUrl: conn.config.baseUrl as string,
      apiPath: (conn.config.apiPath as string) ?? "/rest",
    },
  };
}

/** @deprecated Use getProviderConnection("n8n") instead */
export async function getN8nCredentials(): Promise<N8nCredentials | null> {
  const info = await getN8nConnection();
  return info?.credentials ?? null;
}
