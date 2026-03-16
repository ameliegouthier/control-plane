import { getMakeApiBaseUrlFromEnvOrDefault, getValidMakeAccessToken } from "./make-auth";

/**
 * Low-level helper to call the Make API using the stored OAuth access token.
 * - Resolves a valid access token for the given user (refreshing if needed)
 * - Calls the Make API using Authorization: Bearer <token>
 * - Returns the parsed JSON payload
 */
export async function makeApiFetch<T = unknown>(
  userId: string,
  path: string,
): Promise<T> {
  const accessToken = await getValidMakeAccessToken(userId);
  if (!accessToken) {
    throw new Error("Make is not connected for this user or token is unavailable.");
  }

  const baseUrl = getMakeApiBaseUrlFromEnvOrDefault();
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("http")
    ? path
    : `${normalizedBase}/${path.replace(/^\//, "")}`;

  const res = await fetch(normalizedPath, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text
        ? `Make API request failed with ${res.status}: ${text}`
        : `Make API request failed with status ${res.status}`,
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new Error(
      `Make API responded with non-JSON content-type: ${contentType || "unknown"}`,
    );
  }

  return res.json() as Promise<T>;
}

