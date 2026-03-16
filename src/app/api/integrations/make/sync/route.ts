import { NextRequest, NextResponse } from "next/server";
import { getDemoUser } from "@/lib/demo-user";
import { syncMakeWorkflows } from "@/lib/providers/make-adapter";

export const dynamic = "force-dynamic";

/**
 * GET /api/integrations/make/sync
 *
 * For the current (demo) user:
 * - Ensures we have a user id
 * - Uses OAuth-backed Make API client to fetch scenarios + blueprints
 * - Returns the normalized workflows as JSON
 */
export async function GET(_req: NextRequest) {
  try {
    const user = await getDemoUser();
    const result = await syncMakeWorkflows(user.id);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/integrations/make/sync] Failed to sync Make workflows", err);
    return NextResponse.json(
      {
        error: "MAKE_SYNC_FAILED",
        message: "Failed to fetch Make workflows.",
      },
      { status: 500 },
    );
  }
}

