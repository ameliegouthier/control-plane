import { prisma } from "./prisma";
import { getDemoUser } from "./demo-user";
import { decrypt } from "./crypto";
import type { N8nCredentials, N8nAuthType } from "./n8n-client";

// Re-export so callers that only need the type can import from here
export type { N8nCredentials };

export interface N8nConnectionInfo {
  connectionId: string;
  userId: string;
  credentials: N8nCredentials;
}

/**
 * Load the active n8n connection from DB for the current user.
 * Returns decrypted credentials + IDs needed for syncing workflows.
 * Returns null if no valid active connection exists.
 *
 * Supports both auth types:
 *   - "apiKey"  → decrypts encryptedApiKey
 *   - "basic"   → decrypts encryptedUsername + encryptedPassword
 *
 * Backward-compatible with the old config format (no authType field)
 * which stored only { baseUrl, encryptedApiKey }.
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
  if (!config.baseUrl) return null;

  try {
    const authType: N8nAuthType = config.authType === "basic" ? "basic" : "apiKey";
    const apiPath = config.apiPath ?? (authType === "apiKey" ? "/api/v1" : "/rest");

    if (authType === "apiKey") {
      if (!config.encryptedApiKey) return null;
      return {
        connectionId: connection.id,
        userId: user.id,
        credentials: {
          baseUrl: config.baseUrl,
          authType,
          apiPath,
          apiKey: decrypt(config.encryptedApiKey),
        },
      };
    }

    // authType === "basic"
    if (!config.encryptedUsername || !config.encryptedPassword) return null;
    return {
      connectionId: connection.id,
      userId: user.id,
      credentials: {
        baseUrl: config.baseUrl,
        authType,
        apiPath,
        username: decrypt(config.encryptedUsername),
        password: decrypt(config.encryptedPassword),
      },
    };
  } catch {
    return null;
  }
}

/** Shorthand — returns just the credentials (backward compat). */
export async function getN8nCredentials(): Promise<N8nCredentials | null> {
  const info = await getN8nConnection();
  return info?.credentials ?? null;
}
