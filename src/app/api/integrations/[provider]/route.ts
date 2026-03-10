import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { normalizeBaseUrl, validateBaseUrl } from "@/lib/n8n-client";

export const dynamic = "force-dynamic";

// ─── POST /api/integrations/[provider] ───────────────────────────────────────
// Create or update an Integration (automation tool: n8n, make, zapier).
// Body: baseUrl (required), apiKey (n8n), apiToken (make/zapier).

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  console.log("Integration connect request:", provider);

  if (!provider) {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST", message: "Provider is required." },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_URL", message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { baseUrl: rawBaseUrl, apiKey, apiToken } = body;
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

  let config: Record<string, string>;
  if (provider === "n8n") {
    const apiPath =
      typeof apiKey === "string" && apiKey.trim() ? "/api/v1" : "/rest";
    config = { baseUrl: normalized, apiPath };
    if (typeof apiKey === "string" && apiKey.trim()) {
      config.apiKey = apiKey.trim();
    }
  } else {
    // make, zapier, or other integration: store baseUrl + token
    config = { baseUrl: normalized };
    const token = typeof apiToken === "string" && apiToken.trim() ? apiToken.trim() : (typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : undefined);
    if (token) config.token = token;
  }

  try {
    const db = prisma as any;
    const existing = await db.integration.findFirst({
      where: { userId: user.id, provider },
    });

    const integration = existing
      ? await db.integration.update({
          where: { id: existing.id },
          data: { config, status: "ACTIVE", updatedAt: new Date() },
        })
      : await db.integration.create({
          data: {
            userId: user.id,
            provider,
            name: provider,
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
    console.error("[POST /api/integrations/%s] DB error:", provider, err);
    return NextResponse.json(
      { ok: false, code: "INTEGRATION_ERROR", message: "Failed to save integration." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!provider) {
    return NextResponse.json(
      { success: false, error: "Provider is required." },
      { status: 400 },
    );
  }

  try {
    const db = prisma as any;

    const integrations = await db.integration.findMany({
      where: {
        provider,
      },
      select: {
        id: true,
      },
    });

    const integrationIds = integrations.map((integration: { id: string }) => integration.id);

    if (integrationIds.length > 0) {
      await db.workflow.deleteMany({
        where: {
          integrationId: {
            in: integrationIds,
          },
        },
      });
    }

    await db.integration.deleteMany({
      where: {
        provider,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete integration and workflows", error);

    return NextResponse.json(
      { success: false, error: "Failed to delete integration." },
      { status: 500 },
    );
  }
}