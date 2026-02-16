import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { normalizeBaseUrl, validateBaseUrl } from "@/lib/n8n-client";

export const dynamic = "force-dynamic";

// ─── GET /api/connections/n8n ───────────────────────────────────────────────

export async function GET() {
  try {
    const user = await getDemoUser();
    const connection = await prisma.connection.findUnique({
      where: { userId_tool: { userId: user.id, tool: "N8N" } },
    });

    const config = connection?.config as Record<string, string> | null;
    const connected = connection?.status === "ACTIVE" && !!config?.baseUrl;

    return NextResponse.json({
      connected,
      ...(connected && config ? { baseUrl: config.baseUrl } : {}),
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

// ─── POST /api/connections/n8n ──────────────────────────────────────────────
// MVP: saves baseUrl only (no auth secrets).

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_URL", message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { baseUrl } = body;

  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    return NextResponse.json(
      { ok: false, code: "INVALID_URL", message: "baseUrl is required." },
      { status: 400 },
    );
  }

  const urlResult = validateBaseUrl(baseUrl);
  if (!urlResult.ok) {
    return NextResponse.json(urlResult, { status: 400 });
  }

  const user = await getDemoUser();
  const normalized = normalizeBaseUrl(baseUrl);

  try {
    const config = { baseUrl: normalized, apiPath: "/rest" };

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
