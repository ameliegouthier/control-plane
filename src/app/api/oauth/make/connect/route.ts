import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const MAKE_AUTHORIZE_URL = "https://www.make.com/oauth/v2/authorize";

/**
 * GET /api/oauth/make/connect
 *
 * Starts the OAuth flow with Make by:
 * - Generating a random state
 * - Persisting it in a secure cookie
 * - Redirecting the user to Make's authorization URL
 *
 * This handler is defensive: if required environment variables are missing,
 * it returns a clear JSON error instead of throwing.
 */
export async function GET(_req: NextRequest) {
  const clientId = process.env.MAKE_CLIENT_ID;
  const redirectUri = process.env.MAKE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error: "MAKE_OAUTH_NOT_CONFIGURED",
        message:
          "Make OAuth is not configured. Please set MAKE_CLIENT_ID and MAKE_REDIRECT_URI.",
      },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();

  const cookieStore = cookies();
  cookieStore.set("make_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });

  const url = new URL(MAKE_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "openid scenarios:read");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}

