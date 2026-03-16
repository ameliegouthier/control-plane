import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProviderAdapter } from "@/lib/providers";
import type { AutomationProvider, ProviderConnection } from "@/lib/providers/types";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json(
      { error: "Integration id is required" },
      { status: 400 }
    );
  }

  const integration = await prisma.integration.findUnique({
    where: { id },
  });

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 }
    );
  }

  const provider = integration.provider.toLowerCase() as AutomationProvider;
  let adapter;
  try {
    adapter = getProviderAdapter(provider);
  } catch {
    return NextResponse.json(
      { error: "Unsupported provider" },
      { status: 400 }
    );
  }

  const statusValue =
    integration.status === "ACTIVE" ||
    integration.status === "INACTIVE" ||
    integration.status === "ERROR"
      ? (integration.status as ProviderConnection["status"])
      : "ACTIVE";

  const connection: ProviderConnection = {
    id: integration.id,
    provider,
    userId: integration.userId,
    status: statusValue,
    config: (integration.config ?? {}) as Record<string, unknown>,
    lastSyncedAt: integration.updatedAt,
  };

  try {
    const result = await adapter.syncWorkflows(connection);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /api/integrations/[id]/sync] Sync error", {
      integrationId: integration.id,
      provider: integration.provider,
      error,
    });

    return NextResponse.json(
      { error: "Failed to sync workflows" },
      { status: 500 }
    );
  }
}

