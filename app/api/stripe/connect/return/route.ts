import { NextResponse } from "next/server";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncStripeAccount } from "@/lib/stripe-connect";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  const origin = new URL(request.url).origin;

  if (admin.isTeamWorkspace) {
    return NextResponse.redirect(`${origin}/admin/settings?tab=profile`);
  }

  const adminId = ownerAdminId(admin);
  const integration = await prisma.stripeConnectIntegration.findUnique({
    where: { adminId },
    select: { stripeAccountId: true }
  });

  if (!integration) {
    return NextResponse.redirect(`${origin}/admin/settings?tab=integrations&stripe=missing-account`);
  }

  try {
    const updated = await syncStripeAccount(adminId, integration.stripeAccountId);
    const status = updated.chargesEnabled ? "connected" : "pending";

    return NextResponse.redirect(`${origin}/admin/settings?tab=integrations&stripe=${status}`);
  } catch (error) {
    console.error("Stripe Connect sync failed", error);
    return NextResponse.redirect(`${origin}/admin/settings?tab=integrations&stripe=error`);
  }
}
