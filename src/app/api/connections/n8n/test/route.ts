import { NextRequest, NextResponse } from "next/server";
import { testN8nConnection } from "@/lib/n8n-client";

export const dynamic = "force-dynamic";

/**
 * POST /api/connections/n8n/test
 *
 * MVP: reachability-only test. No auth.
 * Body: { baseUrl }
 */
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

  const result = await testN8nConnection(baseUrl);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
