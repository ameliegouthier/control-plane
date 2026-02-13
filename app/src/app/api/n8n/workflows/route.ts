import { NextResponse } from "next/server";
import { syncN8nWorkflows } from "@/lib/n8n-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await syncN8nWorkflows();

  if (!result.success) {
    const status = result.error?.includes("not connected") ? 400 : 500;
    return NextResponse.json(
      { error: result.error ?? "Sync failed" },
      { status },
    );
  }

  // Return the raw n8n payload for backward compatibility
  return NextResponse.json(result.rawPayload ?? { data: [], synced: result.synced });
}
