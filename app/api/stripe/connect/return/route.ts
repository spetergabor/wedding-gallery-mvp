import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { connectStandardStripeAccount, exchangeStripeOAuthCode, isStripeConnectConfigured, STRIPE_CONNECT_OAUTH_STATE_COOKIE } from "@/lib/stripe-connect";
import { logSystemEvent, systemEventErrorMessage } from "@/lib/system-events";

function settingsUrl(origin: string, params: Record<string, string>) {
  const url = new URL("/admin/settings", origin);
  url.searchParams.set("tab", "integrations");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  const origin = new URL(request.url).origin;

  if (admin.isTeamWorkspace) {
    return NextResponse.redirect(settingsUrl(origin, { stripe: "team-workspace" }));
  }

  if (!isStripeConnectConfigured()) {
    return NextResponse.redirect(settingsUrl(origin, { stripe: "missing-config" }));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stripeError = request.nextUrl.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STRIPE_CONNECT_OAUTH_STATE_COOKIE)?.value;
  const adminId = ownerAdminId(admin);

  if (stripeError) {
    const response = NextResponse.redirect(settingsUrl(origin, { stripe: "oauth-error" }));
    response.cookies.delete(STRIPE_CONNECT_OAUTH_STATE_COOKIE);
    return response;
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    const response = NextResponse.redirect(settingsUrl(origin, { stripe: "state-error" }));
    response.cookies.delete(STRIPE_CONNECT_OAUTH_STATE_COOKIE);
    return response;
  }

  try {
    const token = await exchangeStripeOAuthCode(code);
    const updated = await connectStandardStripeAccount(adminId, token.stripe_user_id!);
    const status = updated.chargesEnabled ? "connected" : "pending";

    await logSystemEvent({
      actorAdminId: admin.id,
      targetAdminId: adminId,
      type: "stripe.connected",
      title: "Stripe fiók összekötve",
      message: updated.stripeAccountEmail ?? updated.stripeAccountId,
      severity: updated.chargesEnabled ? "success" : "info",
      status: updated.chargesEnabled ? "success" : "warning",
      source: "stripe",
      href: "/admin/settings?tab=integrations",
      metadata: {
        stripeAccountId: updated.stripeAccountId,
        chargesEnabled: updated.chargesEnabled,
        payoutsEnabled: updated.payoutsEnabled,
        detailsSubmitted: updated.detailsSubmitted,
        oauthScope: token.scope ?? null,
        livemode: token.livemode ?? null
      }
    });

    const response = NextResponse.redirect(settingsUrl(origin, { stripe: status }));
    response.cookies.delete(STRIPE_CONNECT_OAUTH_STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("Stripe Connect OAuth callback failed", {
      adminId,
      error
    });
    await prisma.stripeConnectIntegration.updateMany({
      where: { adminId },
      data: {
        lastSyncError: systemEventErrorMessage(error).slice(0, 500)
      }
    });
    await logSystemEvent({
      actorAdminId: admin.id,
      targetAdminId: adminId,
      type: "stripe.connect_failed",
      title: "Stripe összekötési hiba",
      message: systemEventErrorMessage(error),
      severity: "error",
      status: "failed",
      source: "stripe",
      href: "/admin/settings?tab=integrations"
    });
    const response = NextResponse.redirect(settingsUrl(origin, { stripe: "callback-error" }));
    response.cookies.delete(STRIPE_CONNECT_OAUTH_STATE_COOKIE);
    return response;
  }
}
