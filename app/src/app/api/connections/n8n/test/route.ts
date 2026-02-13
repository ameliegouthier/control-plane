import { NextRequest, NextResponse } from "next/server";
import {
  type N8nAuthType,
  testN8nConnection,
} from "@/lib/n8n-client";

export const dynamic = "force-dynamic";

/**
 * POST /api/connections/n8n/test
 *
 * Test connectivity + auth against an n8n instance without saving anything.
 * The UI calls this before saving so the user gets immediate feedback.
 *
 * Body: { baseUrl, authType, apiKey?, username?, password? }
 * Returns: { ok, code?, message?, status?, apiPath? }
 */
export async function POST(req: NextRequest) {
  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_URL", message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { baseUrl, authType, apiKey, username, password } = body;

  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    return NextResponse.json(
      { ok: false, code: "INVALID_URL", message: "baseUrl is required." },
      { status: 400 },
    );
  }

  const validAuthTypes: N8nAuthType[] = ["apiKey", "basic"];
  if (typeof authType !== "string" || !validAuthTypes.includes(authType as N8nAuthType)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_URL", message: 'authType must be "apiKey" or "basic".' },
      { status: 400 },
    );
  }

  const at = authType as N8nAuthType;

  if (at === "apiKey" && (typeof apiKey !== "string" || !apiKey.trim())) {
    return NextResponse.json(
      { ok: false, code: "INVALID_CREDENTIALS", message: "apiKey is required." },
      { status: 400 },
    );
  }

  if (at === "basic") {
    if (typeof username !== "string" || !username.trim()) {
      return NextResponse.json(
        { ok: false, code: "INVALID_CREDENTIALS", message: "username (email) is required." },
        { status: 400 },
      );
    }
    if (typeof password !== "string" || !password.trim()) {
      return NextResponse.json(
        { ok: false, code: "INVALID_CREDENTIALS", message: "password is required." },
        { status: 400 },
      );
    }
  }

  // ── Run the test ──────────────────────────────────────────────────────────
  const result = await testN8nConnection(baseUrl, {
    authType: at,
    apiKey: typeof apiKey === "string" ? apiKey : undefined,
    username: typeof username === "string" ? username : undefined,
    password: typeof password === "string" ? password : undefined,
  });

  const httpStatus = result.ok ? 200 : result.status ?? 502;
  return NextResponse.json(result, { status: httpStatus > 499 ? 502 : httpStatus < 400 ? 200 : httpStatus });
}
