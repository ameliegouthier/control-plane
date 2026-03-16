import { prisma } from "@/lib/prisma";

const MAKE_TOKEN_URL = "https://www.make.com/oauth/v2/token";
const MAKE_API_BASE_FALLBACK = "https://eu2.make.com/api/v2";

export interface MakeCredentials {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string | Date | null;
  baseUrl?: string | null;
  [key: string]: unknown;
}

/**
 * Returns a non-expired Make access token for the given user.
 * If the token is expired and a refresh token is available, it will be refreshed
 * and the Integration.credentials record updated atomically.
 */
export async function getValidMakeAccessToken(userId: string): Promise<string | null> {
  const db = prisma as any;

  const integration = await db.integration.findFirst({
    where: {
      userId,
      provider: "make",
    },
  });

  if (!integration) {
    return null;
  }

  const credentials = (integration.credentials ?? {}) as MakeCredentials;
  const currentAccessToken = credentials.accessToken;
  const refreshToken = credentials.refreshToken;
  const expiresAtValue = credentials.expiresAt;

  const expiresAt =
    typeof expiresAtValue === "string"
      ? new Date(expiresAtValue)
      : expiresAtValue instanceof Date
      ? expiresAtValue
      : null;

  const now = new Date();

  if (currentAccessToken && expiresAt && expiresAt.getTime() - now.getTime() > 60_000) {
    return currentAccessToken;
  }

  if (!refreshToken) {
    return null;
  }

  const clientId = process.env.MAKE_CLIENT_ID;
  const clientSecret = process.env.MAKE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  try {
    const res = await fetch(MAKE_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      console.error("[Make OAuth] Refresh token request failed", {
        status: res.status,
        body: await res.text().catch(() => undefined),
      });
      return null;
    }

    const payload = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      [key: string]: unknown;
    };

    if (!payload.access_token) {
      return null;
    }

    const newAccessToken = payload.access_token;
    const newRefreshToken = payload.refresh_token ?? refreshToken;
    const expiresIn =
      typeof payload.expires_in === "number" ? payload.expires_in : 3600;
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000);

    const baseUrl =
      credentials.baseUrl ??
      process.env.MAKE_API_BASE_URL?.trim() ??
      MAKE_API_BASE_FALLBACK;

    const updatedCredentials: MakeCredentials = {
      ...credentials,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt.toISOString(),
      baseUrl,
    };

    await db.integration.update({
      where: { id: integration.id },
      data: {
        credentials: updatedCredentials,
        updatedAt: new Date(),
      },
    });

    return newAccessToken;
  } catch (err) {
    console.error("[Make OAuth] Failed to refresh Make access token", err);
    return null;
  }
}

export function getMakeApiBaseUrlFromEnvOrDefault(): string {
  return (
    process.env.MAKE_API_BASE_URL?.trim() ?? MAKE_API_BASE_FALLBACK
  );
}

