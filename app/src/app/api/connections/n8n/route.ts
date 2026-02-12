import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { encrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// ─── GET /api/connections/n8n ───────────────────────────────────────────────
// Returns { connected: boolean } — used by the frontend to persist state.

export async function GET() {
  try {
    // TODO: Replace getDemoUser() with actual authenticated user from session
    const user = await getDemoUser();

    const connection = await prisma.connection.findUnique({
      where: { userId_tool: { userId: user.id, tool: "N8N" } },
    });

    // Verify the config actually has the encrypted key format
    const config = connection?.config as Record<string, string> | null;
    const connected =
      connection?.status === "ACTIVE" &&
      !!config?.baseUrl &&
      !!config?.encryptedApiKey;

    return NextResponse.json({ connected });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

// ─── POST /api/connections/n8n ──────────────────────────────────────────────
// Body: { baseUrl: string, apiKey: string }
// Tests the connection, then encrypts & saves credentials in DB.

export async function POST(req: NextRequest) {
  // --- Parse body -----------------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { baseUrl, apiKey } = body as Record<string, unknown>;

  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    return NextResponse.json(
      { error: "baseUrl is required" },
      { status: 400 },
    );
  }
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    return NextResponse.json(
      { error: "apiKey is required" },
      { status: 400 },
    );
  }

  // --- Normalize URL --------------------------------------------------------
  const normalizedUrl = baseUrl.trim().replace(/\/+$/, "");

  try {
    new URL(normalizedUrl);
  } catch {
    return NextResponse.json(
      { error: "baseUrl is not a valid URL" },
      { status: 400 },
    );
  }

  // --- Test connection (GET /api/v1/workflows?limit=1) ----------------------
  try {
    const testRes = await fetch(
      `${normalizedUrl}/api/v1/workflows?limit=1`,
      {
        headers: { "X-N8N-API-KEY": apiKey },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!testRes.ok) {
      if (testRes.status === 401 || testRes.status === 403) {
        return NextResponse.json(
          { error: "API key rejected by n8n (401/403)" },
          { status: 401 },
        );
      }
      return NextResponse.json(
        { error: `n8n responded with status ${testRes.status}` },
        { status: 502 },
      );
    }
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Cannot reach n8n at this URL";
    return NextResponse.json(
      { error: `Connection failed: ${msg}` },
      { status: 502 },
    );
  }

  // --- Get user (demo for now) -----------------------------------------------
  // TODO: Replace getDemoUser() with actual authenticated user from session
  const user = await getDemoUser();

  // --- Encrypt API key & upsert connection ----------------------------------
  try {
    const encryptedApiKey = encrypt(apiKey);

    const connection = await prisma.connection.upsert({
      where: {
        userId_tool: { userId: user.id, tool: "N8N" },
      },
      update: {
        config: { baseUrl: normalizedUrl, encryptedApiKey },
        status: "ACTIVE",
      },
      create: {
        userId: user.id,
        tool: "N8N",
        config: { baseUrl: normalizedUrl, encryptedApiKey },
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      status: connection.status,
    });
  } catch (err: unknown) {
    console.error("[POST /api/connections/n8n] DB error:", err);
    return NextResponse.json(
      { error: "Failed to save connection" },
      { status: 500 },
    );
  }
}
