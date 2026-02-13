import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { encrypt } from "@/lib/crypto";
import {
  type N8nAuthType,
  testN8nConnection,
  normalizeBaseUrl,
} from "@/lib/n8n-client";

export const dynamic = "force-dynamic";

// ─── GET /api/connections/n8n ───────────────────────────────────────────────
// Returns { connected, baseUrl?, authType? } — no secrets.

export async function GET() {
  try {
    const user = await getDemoUser();

    const connection = await prisma.connection.findUnique({
      where: { userId_tool: { userId: user.id, tool: "N8N" } },
    });

    const config = connection?.config as Record<string, string> | null;

    const connected =
      connection?.status === "ACTIVE" &&
      !!config?.baseUrl &&
      !!config?.authType;

    return NextResponse.json({
      connected,
      ...(connected && config
        ? { baseUrl: config.baseUrl, authType: config.authType }
        : {}),
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

// ─── POST /api/connections/n8n ──────────────────────────────────────────────
// Body: { baseUrl, authType, apiKey?, username?, password? }
// Tests the connection, then encrypts & saves credentials in DB.

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

  // ── Validate inputs ───────────────────────────────────────────────────────
  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    return NextResponse.json(
      { ok: false, code: "INVALID_URL", message: "baseUrl is required." },
      { status: 400 },
    );
  }

  const validAuthTypes: N8nAuthType[] = ["apiKey", "basic"];
  if (
    typeof authType !== "string" ||
    !validAuthTypes.includes(authType as N8nAuthType)
  ) {
    return NextResponse.json(
      {
        ok: false,
        code: "INVALID_URL",
        message: 'authType must be "apiKey" or "basic".',
      },
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

  // ── Test connection ───────────────────────────────────────────────────────
  const testResult = await testN8nConnection(baseUrl as string, {
    authType: at,
    apiKey: typeof apiKey === "string" ? apiKey : undefined,
    username: typeof username === "string" ? username : undefined,
    password: typeof password === "string" ? password : undefined,
  });

  if (!testResult.ok) {
    console.warn("[POST /api/connections/n8n] test failed:", testResult);
    const httpStatus = testResult.status ?? 502;
    return NextResponse.json(testResult, {
      status: httpStatus > 499 ? 502 : httpStatus < 400 ? 422 : httpStatus,
    });
  }

  // ── Save to DB ────────────────────────────────────────────────────────────
  const user = await getDemoUser();
  const normalized = normalizeBaseUrl(baseUrl as string);

  try {
    // Build config blob — secrets are encrypted, everything else is plain
    const config: Record<string, string> = {
      baseUrl: normalized,
      authType: at,
      apiPath: testResult.apiPath ?? (at === "apiKey" ? "/api/v1" : "/rest"),
    };

    if (at === "apiKey") {
      config.encryptedApiKey = encrypt(apiKey as string);
    } else {
      config.encryptedUsername = encrypt(username as string);
      config.encryptedPassword = encrypt(password as string);
    }

    const connection = await prisma.connection.upsert({
      where: { userId_tool: { userId: user.id, tool: "N8N" } },
      update: { config, status: "ACTIVE" },
      create: { userId: user.id, tool: "N8N", config, status: "ACTIVE" },
    });

    return NextResponse.json({
      ok: true,
      connectionId: connection.id,
      status: connection.status,
    });
  } catch (err: unknown) {
    console.error("[POST /api/connections/n8n] DB error:", err);
    return NextResponse.json(
      { ok: false, code: "N8N_ERROR", message: "Failed to save connection." },
      { status: 500 },
    );
  }
}
