import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";
import { toWorkflow } from "@/app/workflow-helpers";

export const dynamic = "force-dynamic";

// ─── GET /api/workflows ─────────────────────────────────────────────────────
// Reads workflows from DB (already synced).
// Optional query params: ?tool=N8N&connectionId=xxx
// Returns the same shape the frontend Workflow type expects.

export async function GET(req: NextRequest) {
  try {
    // TODO: Replace getDemoUser() with actual authenticated user from session
    const user = await getDemoUser();

    const params = req.nextUrl.searchParams;
    const tool = params.get("tool"); // e.g. "N8N"
    const connectionId = params.get("connectionId");

    // Build where clause
    const where: Record<string, unknown> = { userId: user.id };
    if (connectionId) {
      where.connectionId = connectionId;
    }
    if (tool) {
      where.connection = { tool };
    }

    const dbWorkflows = await prisma.workflow.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    const data = dbWorkflows.map(toWorkflow);

    return NextResponse.json({ data, count: data.length });
  } catch (err: unknown) {
    console.error("[GET /api/workflows] error:", err);
    return NextResponse.json(
      { error: "Failed to load workflows" },
      { status: 500 },
    );
  }
}
