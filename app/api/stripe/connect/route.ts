import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { buildStripeStandardOAuthUrl, isStripeConnectConfigured, STRIPE_CONNECT_OAUTH_STATE_COOKIE } from "@/lib/stripe-connect";

function settingsUrl(origin: string, params: Record<string, string>) {
  const url = new URL("/admin/settings", origin);
  url.searchParams.set("tab", "integrations");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

export async function GET(request: Request) {
  const admin = await requireAdmin();
  const origin = new URL(request.url).origin;

  if (admin.isTeamWorkspace) {
    return NextResponse.redirect(settingsUrl(origin, { stripe: "team-workspace" }));
  }

  if (!isStripeConnectConfigured()) {
    return NextResponse.redirect(settingsUrl(origin, { stripe: "missing-config" }));
  }

  try {
    const state = randomBytes(24).toString("base64url");
    const url = buildStripeStandardOAuthUrl({
      origin,
      state,
      email: admin.email
    });
    const response = NextResponse.redirect(url);

    response.cookies.set(STRIPE_CONNECT_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/stripe/connect/return",
      maxAge: 10 * 60
    });

    return response;
  } catch (error) {
    console.error("Stripe Connect OAuth start failed", {
      adminId: ownerAdminId(admin),
      error
    });
    return NextResponse.redirect(settingsUrl(origin, { stripe: "error" }));
  }
}
