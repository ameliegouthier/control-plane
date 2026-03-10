import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "demo_mode";
const COOKIE_PATH = "/";

/**
 * POST /api/demo-mode
 * Body: { enabled: boolean }
 * Sets cookie demo_mode to "true" or "false" and returns the new state.
 */
export async function POST(req: NextRequest) {
  let body: { enabled?: boolean };
  try {
    body = (await req.json()) as { enabled?: boolean };
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const enabled = body.enabled === true;

  const response = NextResponse.json({
    success: true,
    demoMode: enabled,
  });

  response.cookies.set(COOKIE_NAME, enabled ? "true" : "false", {
    path: COOKIE_PATH,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return response;
}
