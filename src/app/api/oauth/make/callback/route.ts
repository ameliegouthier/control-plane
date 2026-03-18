import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo-user";

const MAKE_TOKEN_URL = "https://www.make.com/oauth/v2/token";
const MAKE_API_BASE_FALLBACK = "https://eu2.make.com/api/v2";

interface MakeTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  [key: string]: unknown;
}

export const dynamic = "force-dynamic";

/**
 * GET /api/oauth/make/callback
 *
 * Handles the OAuth callback from Make:
 * - Validates state against the cookie
 * - Exchanges the authorization code for tokens
 * - Persists the Make integration credentials in the Integration table
 * - Redirects back to the integrations settings page on success
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.json(
      {
        error: "MAKE_OAUTH_ERROR",
        message: "Make OAuth returned an error.",
        details: error,
      },
      { status: 400 },
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      {
        error: "INVALID_OAUTH_RESPONSE",
        message: "Missing code or state in Make OAuth callback.",
      },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("make_oauth_state")?.value;

  // Clear the state cookie to avoid reuse.
  cookieStore.set("make_oauth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  if (!storedState || storedState !== state) {
    return NextResponse.json(
      {
        error: "STATE_MISMATCH",
        message: "Invalid OAuth state. Please try connecting Make again.",
      },
      { status: 400 },
    );
  }

  const clientId = process.env.MAKE_CLIENT_ID;
  const clientSecret = process.env.MAKE_CLIENT_SECRET;
  const redirectUri = process.env.MAKE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      {
        error: "MAKE_OAUTH_NOT_CONFIGURED",
        message:
          "Make OAuth is not fully configured. Please set MAKE_CLIENT_ID, MAKE_CLIENT_SECRET, and MAKE_REDIRECT_URI.",
      },
      { status: 500 },
    );
  }

  let tokenPayload: MakeTokenResponse | null = null;

  try {
    const tokenRes = await fetch(MAKE_TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text().catch(() => "");
      return NextResponse.json(
        {
          error: "TOKEN_EXCHANGE_FAILED",
          message: "Failed to exchange authorization code for tokens with Make.",
          status: tokenRes.status,
          body: text || undefined,
        },
        { status: 502 },
      );
    }

    tokenPayload = (await tokenRes.json()) as MakeTokenResponse;
  } catch (err) {
    console.error("[Make OAuth] Token exchange error", err);
    return NextResponse.json(
      {
        error: "TOKEN_EXCHANGE_ERROR",
        message: "Unexpected error while talking to Make token endpoint.",
      },
      { status: 502 },
    );
  }

  if (!tokenPayload?.access_token || !tokenPayload.refresh_token) {
    return NextResponse.json(
      {
        error: "INVALID_TOKEN_RESPONSE",
        message: "Make token response is missing access_token or refresh_token.",
        payload: tokenPayload,
      },
      { status: 502 },
    );
  }

  const accessToken = tokenPayload.access_token;
  const refreshToken = tokenPayload.refresh_token;
  const expiresIn = typeof tokenPayload.expires_in === "number" ? tokenPayload.expires_in : 3600;

  const now = Date.now();
  const expiresAt = new Date(now + expiresIn * 1000);
  const baseUrl =
    process.env.MAKE_API_BASE_URL?.trim() || MAKE_API_BASE_FALLBACK;

  const user = await getDemoUser();
  const db = prisma as any;

  try {
    const existing = await db.integration.findFirst({
      where: {
        userId: user.id,
        provider: "make",
      },
    });

    const credentials = {
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
      baseUrl,
    };

    const config = {
      baseUrl,
    };

    if (existing) {
      await db.integration.update({
        where: { id: existing.id },
        data: {
          credentials,
          config,
          status: "ACTIVE",
          updatedAt: new Date(),
        },
      });
    } else {
      await db.integration.create({
        data: {
          userId: user.id,
          provider: "make",
          name: "Make",
          status: "ACTIVE",
          credentials,
          config,
        },
      });
    }
  } catch (err) {
    console.error("[Make OAuth] Failed to persist integration", err);
    return NextResponse.json(
      {
        error: "INTEGRATION_PERSIST_FAILED",
        message: "Failed to store Make integration credentials.",
      },
      { status: 500 },
    );
  }

  const origin = req.nextUrl.origin;
  const redirectUrl = new URL(
    "/settings/integrations?make=connected",
    origin,
  );

  return NextResponse.redirect(redirectUrl.toString());
}

