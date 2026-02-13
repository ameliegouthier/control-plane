/**
 * n8n API client helpers.
 *
 * All external calls to n8n happen server-side through these functions.
 * Supports two auth methods:
 *   - "apiKey"  → X-N8N-API-KEY header on /api/v1/* endpoints
 *   - "basic"   → POST /rest/login (email+password) → session cookie on /rest/*
 *
 * Every request includes "ngrok-skip-browser-warning: true" so ngrok tunnels
 * don't return an HTML interstitial instead of JSON.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type N8nAuthType = "apiKey" | "basic";

/** What the client sends in the request body (plaintext secrets). */
export interface N8nAuthInput {
  authType: N8nAuthType;
  apiKey?: string;
  username?: string; // n8n email
  password?: string;
}

/** Decrypted credentials used at runtime to call the n8n API. */
export interface N8nCredentials {
  baseUrl: string;
  authType: N8nAuthType;
  apiPath: string; // "/api/v1" or "/rest"
  apiKey?: string;
  username?: string;
  password?: string;
}

/** Structured error codes returned by test / connect endpoints. */
export type N8nErrorCode =
  | "INVALID_URL"
  | "LOCALHOST_NOT_ALLOWED"
  | "N8N_UNREACHABLE"
  | "INVALID_CREDENTIALS"
  | "AUTH_REQUIRED"
  | "WRONG_BASE_URL_OR_API_PATH"
  | "NOT_JSON"
  | "N8N_ERROR";

export interface N8nTestResult {
  ok: boolean;
  code?: N8nErrorCode;
  message?: string;
  status?: number;
  /** Which API base path worked: "/api/v1" or "/rest" */
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
    return {
      ok: false,
      code: "INVALID_URL",
      message: "URL must start with http:// or https://.",
    };
  }

  // Block localhost when running on Vercel (it can't reach the user's machine)
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
          "This app runs on Vercel and cannot reach localhost. " +
          "Use ngrok to expose your n8n instance.",
      };
    }
  }

  return { ok: true, url: normalized };
}

// ─── Internal header builders ───────────────────────────────────────────────

/** Headers included in every request to n8n (ngrok bypass + JSON accept). */
function commonHeaders(): Record<string, string> {
  return {
    "ngrok-skip-browser-warning": "true",
    Accept: "application/json",
  };
}

/**
 * Extract cookie name=value pairs from a raw Set-Cookie header string.
 * Strips attributes (Path, HttpOnly, etc.) so it can be sent as a Cookie header.
 */
function extractCookie(setCookie: string): string {
  // `get("set-cookie")` may concatenate multiple cookies with ", "
  // but each cookie's attributes are separated by "; ".
  // Safe approach: split on "; " first, grab only the name=value parts.
  return setCookie
    .split(",")
    .map((part) => part.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

// ─── Test connection ────────────────────────────────────────────────────────

/**
 * Test whether we can reach and authenticate against a given n8n instance.
 * Returns a structured result the UI can map to clear error messages.
 */
export async function testN8nConnection(
  baseUrl: string,
  auth: N8nAuthInput,
): Promise<N8nTestResult> {
  // 1. Validate URL
  const urlResult = validateBaseUrl(baseUrl);
  if (!urlResult.ok) return urlResult;

  const url = urlResult.url;

  // 2. Dispatch by auth type
  if (auth.authType === "apiKey") {
    return testWithApiKey(url, auth.apiKey ?? "");
  }
  return testWithLogin(url, auth.username ?? "", auth.password ?? "");
}

// ── apiKey path: GET /api/v1/workflows?limit=1 ─────────────────────────────

async function testWithApiKey(
  baseUrl: string,
  apiKey: string,
): Promise<N8nTestResult> {
  const testUrl = `${baseUrl}/api/v1/workflows?limit=1`;

  try {
    console.log("[n8n-client] testing API key auth →", testUrl);
    const res = await fetch(testUrl, {
      headers: { ...commonHeaders(), "X-N8N-API-KEY": apiKey },
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        return {
          ok: false,
          code: "NOT_JSON",
          message:
            "Response is not JSON — possibly a login page or ngrok interstitial.",
          status: res.status,
        };
      }
      return { ok: true, apiPath: "/api/v1" };
    }

    return mapHttpError(res.status, baseUrl, "/api/v1");
  } catch (err) {
    return mapFetchError(err, baseUrl);
  }
}

// ── basic (login) path: POST /rest/login then GET /rest/workflows ──────────

async function testWithLogin(
  baseUrl: string,
  email: string,
  password: string,
): Promise<N8nTestResult> {
  // Step 1 — login
  let cookie: string;
  try {
    console.log("[n8n-client] testing login auth → POST", `${baseUrl}/rest/login`);
    const loginRes = await fetch(`${baseUrl}/rest/login`, {
      method: "POST",
      headers: { ...commonHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!loginRes.ok) {
      if (loginRes.status === 401 || loginRes.status === 403) {
        return {
          ok: false,
          code: "INVALID_CREDENTIALS",
          message: "Login failed — check your email and password.",
          status: loginRes.status,
        };
      }
      if (loginRes.status === 404) {
        return {
          ok: false,
          code: "WRONG_BASE_URL_OR_API_PATH",
          message:
            "Login endpoint not found at /rest/login. Check the base URL.",
          status: 404,
        };
      }
      return {
        ok: false,
        code: "N8N_ERROR",
        message: `Login returned HTTP ${loginRes.status}.`,
        status: loginRes.status,
      };
    }

    cookie = extractCookie(loginRes.headers.get("set-cookie") ?? "");
  } catch (err) {
    return mapFetchError(err, baseUrl);
  }

  // Step 2 — fetch /rest/workflows with session cookie
  try {
    const headers: Record<string, string> = commonHeaders();
    if (cookie) headers["Cookie"] = cookie;

    const res = await fetch(`${baseUrl}/rest/workflows?limit=1`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        return {
          ok: false,
          code: "NOT_JSON",
          message: "Response is not JSON.",
          status: res.status,
        };
      }
      return { ok: true, apiPath: "/rest" };
    }

    return mapHttpError(res.status, baseUrl, "/rest");
  } catch (err) {
    return mapFetchError(err, baseUrl);
  }
}

// ─── Authenticated fetch (used by sync + any future n8n call) ───────────────

/**
 * Make an authenticated request to the n8n API.
 *
 * @param creds  Decrypted credentials (from DB via getN8nConnection)
 * @param path   Path *after* the apiPath prefix, e.g. "/workflows"
 * @param opts   Optional method + body
 */
export async function fetchN8nApi(
  creds: N8nCredentials,
  path: string,
  opts?: { method?: string; body?: unknown },
): Promise<Response> {
  const url = `${creds.baseUrl}${creds.apiPath}${path}`;
  const method = opts?.method ?? "GET";

  const headers: Record<string, string> = { ...commonHeaders() };
  if (opts?.body) headers["Content-Type"] = "application/json";

  // ── API key auth ──────────────────────────────────────────────────────────
  if (creds.authType === "apiKey") {
    if (!creds.apiKey) throw new Error("Missing apiKey in credentials");
    headers["X-N8N-API-KEY"] = creds.apiKey;

    return fetch(url, {
      method,
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  }

  // ── Login-based auth ─────────────────────────────────────────────────────
  if (!creds.username || !creds.password) {
    throw new Error("Missing username/password in credentials");
  }

  // Login first
  const loginRes = await fetch(`${creds.baseUrl}/rest/login`, {
    method: "POST",
    headers: { ...commonHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ email: creds.username, password: creds.password }),
    cache: "no-store",
  });

  if (!loginRes.ok) {
    throw new Error(`n8n login failed with status ${loginRes.status}`);
  }

  const cookie = extractCookie(loginRes.headers.get("set-cookie") ?? "");
  if (cookie) headers["Cookie"] = cookie;

  return fetch(url, {
    method,
    headers,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
}

// ─── Error mapping ──────────────────────────────────────────────────────────

function mapHttpError(
  status: number,
  baseUrl: string,
  apiPath: string,
): N8nTestResult {
  if (status === 401 || status === 403) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: `n8n rejected the credentials (HTTP ${status}).`,
      status,
    };
  }
  if (status === 404) {
    return {
      ok: false,
      code: "WRONG_BASE_URL_OR_API_PATH",
      message: `n8n API not found at ${baseUrl}${apiPath}/… (HTTP 404). Check the base URL.`,
      status,
    };
  }
  return {
    ok: false,
    code: "N8N_ERROR",
    message: `n8n responded with HTTP ${status}.`,
    status,
  };
}

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
