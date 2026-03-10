import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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