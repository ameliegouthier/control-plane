import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { normalizeBaseUrl, validateBaseUrl } from "@/lib/n8n-client";

export const dynamic = "force-dynamic";

// ─── GET /api/connections/n8n ───────────────────────────────────────────────

export async function GET() {
  try {
    const user = await getDemoUser();
    const integration = await prisma.integration.findFirst({
      where: { userId: user.id, provider: "n8n" },
    });

    const config = integration?.config as Record<string, string> | null;
    const connected = integration?.status === "ACTIVE" && !!config?.baseUrl;

    return NextResponse.json({
      connected,
      ...(connected && config ? { baseUrl: config.baseUrl } : {}),
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

// ─── POST /api/connections/n8n ──────────────────────────────────────────────
// Accepts baseUrl and optional apiKey. When apiKey is set, uses /api/v1 and stores apiKey in config.

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

  const { baseUrl: rawBaseUrl, apiKey } = body;
  const baseUrl = typeof rawBaseUrl === "string" ? rawBaseUrl : undefined;

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

  // When API key is provided, use n8n API v1 path (/api/v1); otherwise /rest
  const apiPath =
    typeof apiKey === "string" && apiKey.trim()
      ? "/api/v1"
      : "/rest";
  const config: Record<string, string> = {
    baseUrl: normalized,
    apiPath,
  };
  if (typeof apiKey === "string" && apiKey.trim()) {
    config.apiKey = apiKey.trim();
  }

  try {
    const existing = await prisma.integration.findFirst({
      where: { userId: user.id, provider: "n8n" },
    });

    const integration = existing
      ? await prisma.integration.update({
          where: { id: existing.id },
          data: { config, status: "ACTIVE", updatedAt: new Date() },
        })
      : await prisma.integration.create({
          data: {
            userId: user.id,
            provider: "n8n",
            name: "n8n",
            status: "ACTIVE",
            config,
          },
        });

    return NextResponse.json({
      ok: true,
      connectionId: integration.id,
      status: integration.status,
    });
  } catch (err: unknown) {
    console.error("[POST /api/connections/n8n] DB error:", err);
    return NextResponse.json(
      { ok: false, code: "N8N_ERROR", message: "Failed to save connection." },
      { status: 500 },
    );
  }
}
