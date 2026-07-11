import { NextResponse } from "next/server";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { createStripeConnectAccountLink, isStripeConnectConfigured } from "@/lib/stripe-connect";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  const origin = new URL(request.url).origin;

  if (admin.isTeamWorkspace) {
    return NextResponse.redirect(`${origin}/admin/settings?tab=profile`);
  }

  if (!isStripeConnectConfigured()) {
    return NextResponse.redirect(`${origin}/admin/settings?tab=integrations&stripe=missing-config`);
  }

  try {
    const url = await createStripeConnectAccountLink({
      adminId: ownerAdminId(admin),
      email: admin.email,
      name: admin.name,
      origin
    });

    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Stripe Connect onboarding failed", error);
    return NextResponse.redirect(`${origin}/admin/settings?tab=integrations&stripe=error`);
  }
}
