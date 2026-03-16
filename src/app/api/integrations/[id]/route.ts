import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { normalizeBaseUrl, validateBaseUrl } from "@/lib/n8n-client";
import { syncProviderWorkflows } from "@/lib/n8n-sync";

export const dynamic = "force-dynamic";

// ─── POST /api/integrations/[id] ─────────────────────────────────────────────
// Create or update an Integration (id = provider name: n8n, make, zapier).
// Body: baseUrl (required), apiKey (n8n), apiToken (make/zapier).

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const provider = id.toLowerCase();

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
    // make, zapier, or other integration: store baseUrl + token (adapter expects apiToken or apiKey)
    config = { baseUrl: normalized };
    const token = typeof apiToken === "string" && apiToken.trim() ? apiToken.trim() : (typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : undefined);
    if (token) {
      config.apiToken = token;
    }
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

    // Trigger workflow sync so Workflow table is populated (non-blocking)
    if (provider === "n8n" || provider === "make") {
      syncProviderWorkflows(provider).catch(() => {});
    }

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
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const integrationId = id;

  if (!integrationId) {
    return NextResponse.json(
      { success: false, error: "Integration id is required." },
      { status: 400 },
    );
  }

  try {
    const db = prisma as any;

    const { workflowsDeleted, nodesDeleted } = await db.$transaction(
      async (tx: any) => {
        // 1. Find all workflows for this integration
        const workflows = await tx.workflow.findMany({
          where: {
            integrationId,
          },
          select: { id: true },
        });

        const workflowIds = workflows.map((w: { id: string }) => w.id);

        // 2. Delete all workflow nodes linked to those workflows
        let nodesDeletedCount = 0;
        if (workflowIds.length > 0) {
          const nodeResult = await tx.workflowNode.deleteMany({
            where: {
              workflowId: {
                in: workflowIds,
              },
            },
          });
          nodesDeletedCount = nodeResult.count ?? 0;
        }

        // 3. Delete all workflows for this integration
        const workflowResult = await tx.workflow.deleteMany({
          where: {
            integrationId,
          },
        });

        // 4. Delete all sync logs for this integration
        await tx.syncLog.deleteMany({
          where: {
            integrationId,
          },
        });

        // 5. Delete the integration record itself
        await tx.integration.deleteMany({
          where: {
            id: integrationId,
          },
        });

        return {
          workflowsDeleted: workflowResult.count ?? 0,
          nodesDeleted: nodesDeletedCount,
        };
      },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete integration and related data", error);

    return NextResponse.json(
      { success: false, error: "Failed to delete integration data." },
      { status: 500 },
    );
  }
}
