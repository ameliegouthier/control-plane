/**
 * n8n API client helpers (MVP — no login auth).
 *
 * All external calls to n8n happen server-side through these functions.
 * Every request includes "ngrok-skip-browser-warning: true" so ngrok tunnels
 * don't return an HTML interstitial instead of JSON.
 *
 * Auth status: MVP does NOT handle n8n authentication.
 * If /rest/workflows returns 401, we surface AUTH_REQUIRED and let the user
 * continue with demo data.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Decrypted credentials used at runtime to call the n8n API. */
export interface N8nCredentials {
  baseUrl: string;
  apiPath: string; // e.g. "/rest" or "/api/v1"
  /** When set, requests use X-N8N-API-KEY header (n8n API key auth). */
  apiKey?: string;
}

/**
 * Configuration used by the N8nClient.
 * apiPath is optional here so callers can rely on the default.
 */
export interface N8nClientConfig {
  baseUrl: string;
  apiPath?: string;
  apiKey?: string;
}

/** Structured error codes returned by test / connect endpoints. */
export type N8nErrorCode =
  | "INVALID_URL"
  | "LOCALHOST_NOT_ALLOWED"
  | "N8N_UNREACHABLE"
  | "AUTH_REQUIRED"
  | "WRONG_BASE_URL_OR_API_PATH"
  | "NOT_JSON"
  | "N8N_ERROR";

export interface N8nTestResult {
  ok: boolean;
  code?: N8nErrorCode;
  message?: string;
  status?: number;
  apiPath?: string;
}

// ─── URL helpers ────────────────────────────────────────────────────────────

const LOCALHOST_PATTERNS = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];

export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

export function validateBaseUrl(
  raw: string,
): { ok: true; url: string } | { ok: false; code: N8nErrorCode; message: string } {
  const normalized = normalizeBaseUrl(raw);

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return {
      ok: false,
      code: "INVALID_URL",
      message: `"${normalized}" is not a valid URL. Include the protocol (https://…).`,
    };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, code: "INVALID_URL", message: "URL must start with http:// or https://." };
  }

  const isProduction =
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (isProduction) {
    const hostname = parsed.hostname.toLowerCase();
    if (
      LOCALHOST_PATTERNS.some((p) => hostname === p) ||
      hostname.endsWith(".local")
    ) {
      return {
        ok: false,
        code: "LOCALHOST_NOT_ALLOWED",
        message:
          "This app runs on Vercel and cannot reach localhost. Use ngrok to expose your n8n instance.",
      };
    }
  }

  return { ok: true, url: normalized };
}

// ─── Headers ────────────────────────────────────────────────────────────────

/** Headers included in every request to n8n (ngrok bypass + JSON accept). */
function commonHeaders(): Record<string, string> {
  return {
    "ngrok-skip-browser-warning": "true",
    Accept: "application/json",
  };
}

// ─── N8n HTTP Client ──────────────────────────────────────────────────────────

/**
 * Lightweight HTTP client for n8n.
 *
 * Responsible only for:
 * - Building URLs from baseUrl + apiPath
 * - Adding common headers and API key header
 * - Handling HTTP errors with clear messages
 *
 * Adapters should use this client instead of calling fetch directly.
 */
export class N8nClient {
  private readonly baseUrl: string;
  private readonly apiPath: string;
  private readonly apiKey?: string;

  constructor(config: N8nClientConfig) {
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    // Default API path when not provided in config
    this.apiPath = config.apiPath ?? "/api/v1";
    this.apiKey = config.apiKey;
  }

  buildUrl(path: string): string {
    return new URL(`${this.apiPath}${path}`, this.baseUrl).toString();
  }

  /**
   * Low-level request helper.
   * Throws on non-2xx responses with a clear error message.
   */
  async request(path: string): Promise<unknown> {
    const url = this.buildUrl(path);

    const headers: Record<string, string> = {
      ...commonHeaders(),
    };

    if (this.apiKey) {
      headers["X-N8N-API-KEY"] = this.apiKey;
    }

    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      let text = "";
      try {
        text = await res.text();
      } catch {
        // ignore body read errors
      }

      const baseMessage = `n8n API responded with ${res.status}`;
      const message = text ? `${baseMessage}: ${text}` : baseMessage;
      throw new Error(message);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      throw new Error(
        `n8n API responded with ${res.status} but content type was not JSON (${contentType || "unknown"})`
      );
    }

    return res.json();
  }

  async getWorkflows(): Promise<unknown> {
    return this.request("/workflows");
  }
}

// ─── Test connection (reachability only — no auth in MVP) ───────────────────

/**
 * Test whether we can reach a given n8n instance.
 *
 * 1. GET baseUrl                        → reachability check
 * 2. GET baseUrl/rest/workflows?limit=1 → API check
 *
 * If /rest/workflows returns 401/403, we return AUTH_REQUIRED (not a crash).
 */
export async function testN8nConnection(baseUrl: string): Promise<N8nTestResult> {
  const urlResult = validateBaseUrl(baseUrl);
  if (!urlResult.ok) return urlResult;

  const url = urlResult.url;

  // Step 1 — reachability
  try {
    await fetch(url, {
      headers: commonHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return mapFetchError(err, url);
  }

  // Step 2 — try /rest/workflows
  try {
    const res = await fetch(`${url}/rest/workflows?limit=1`, {
      headers: commonHeaders(),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        return {
          ok: false,
          code: "NOT_JSON",
          message: "Response is not JSON — possibly a login page or ngrok interstitial.",
          status: res.status,
        };
      }
      return { ok: true, apiPath: "/rest" };
    }

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        code: "AUTH_REQUIRED",
        message:
          "n8n requires authentication (API key or login). " +
          "Auth is not supported in MVP — use demo data to continue.",
        status: res.status,
      };
    }

    if (res.status === 404) {
      return {
        ok: false,
        code: "WRONG_BASE_URL_OR_API_PATH",
        message: `n8n API not found at ${url}/rest/… (HTTP 404). Check the base URL.`,
        status: 404,
      };
    }

    return {
      ok: false,
      code: "N8N_ERROR",
      message: `n8n responded with HTTP ${res.status}.`,
      status: res.status,
    };
  } catch (err) {
    return mapFetchError(err, url);
  }
}

// ─── Authenticated fetch (ngrok bypass only — no auth in MVP) ───────────────

/**
 * Make a request to the n8n API.
 * When creds.apiKey is set, adds X-N8N-API-KEY header for n8n API key auth.
 */
export async function fetchN8nApi(
  creds: N8nCredentials,
  path: string,
): Promise<Response> {
  const url = `${creds.baseUrl}${creds.apiPath}${path}`;
  const headers: Record<string, string> = { ...commonHeaders() };
  if (creds.apiKey) {
    headers["X-N8N-API-KEY"] = creds.apiKey;
  }
  return fetch(url, { headers, cache: "no-store" });
}

// ─── Error mapping ──────────────────────────────────────────────────────────

function mapFetchError(err: unknown, baseUrl: string): N8nTestResult {
  const raw = err instanceof Error ? err.message : String(err);

  let message = `Cannot reach n8n at ${baseUrl}`;
  if (raw.includes("ENOTFOUND")) {
    message += " — hostname not found.";
  } else if (raw.includes("ECONNREFUSED")) {
    message += " — connection refused. Is n8n running?";
  } else if (raw.includes("timeout") || raw.includes("AbortError")) {
    message += " — request timed out (10 s).";
  } else if (raw.includes("fetch failed")) {
    message += " — make sure the URL is publicly accessible.";
  } else if (raw.includes("certificate") || raw.includes("SSL")) {
    message += " — SSL certificate error.";
  } else {
    message += `: ${raw}`;
  }

  return { ok: false, code: "N8N_UNREACHABLE", message };
}
