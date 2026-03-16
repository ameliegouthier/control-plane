import { NextRequest, NextResponse } from "next/server";
import { syncProviderWorkflows } from "@/lib/n8n-sync";

export const dynamic = "force-dynamic";

const SYNC_PROVIDERS = ["n8n", "make"] as const;

/**
 * GET /api/integrations/[id]/workflows
 * Trigger workflow sync for the given provider (id = n8n, make).
 * Returns synced count so the UI can show workflows after connect.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: provider } = await context.params;

  if (!provider || !SYNC_PROVIDERS.includes(provider as (typeof SYNC_PROVIDERS)[number])) {
    return NextResponse.json(
      { error: "Unsupported provider or provider required." },
      { status: 400 },
    );
  }

  const result = await syncProviderWorkflows(provider as "n8n" | "make");

  if (!result.success) {
    const status = result.error?.includes("not connected") ? 400 : 500;
    return NextResponse.json(
      { error: result.error ?? "Sync failed" },
      { status },
    );
  }

  return NextResponse.json({ synced: result.synced, ok: true });
}
