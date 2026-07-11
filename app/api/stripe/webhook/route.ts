import { NextResponse } from "next/server";
import { GALLERY_PURCHASE_EXPIRED, markPaidGalleryPurchaseFromCheckoutSession } from "@/lib/gallery-sales";
import { prisma } from "@/lib/prisma";
import { verifyStripeWebhookEvent } from "@/lib/stripe-connect";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;

  try {
    event = verifyStripeWebhookEvent(payload, signature);
  } catch (error) {
    console.error("Stripe webhook verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await markPaidGalleryPurchaseFromCheckoutSession(event.data.object, event.account);
    }

    if (event.type === "checkout.session.expired") {
      const purchaseId = event.data.object.metadata?.purchaseId ?? event.data.object.client_reference_id;

      if (purchaseId) {
        await prisma.galleryPurchase.updateMany({
          where: {
            id: purchaseId,
            status: "pending"
          },
          data: {
            status: GALLERY_PURCHASE_EXPIRED,
            fulfillmentError: "Stripe Checkout session expired."
          }
        });
      }
    }
  } catch (error) {
    console.error("Stripe webhook handling failed", {
      eventId: event.id,
      eventType: event.type,
      error
    });
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
