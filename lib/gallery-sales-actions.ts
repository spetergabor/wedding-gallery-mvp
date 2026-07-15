"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GALLERY_DELIVERY_PAID } from "@/lib/gallery-delivery";
import { GALLERY_PURCHASE_PENDING, normalizeSaleCurrency } from "@/lib/gallery-sales";
import { createConnectedCheckoutSession } from "@/lib/stripe-connect";
import { PHOTO_DELIVERY_STAGE_FINAL, PROOFING_STATUS_DELIVERED, isProofingGallery } from "@/lib/proofing";

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeName(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function requestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";

  if (host) {
    return `${protocol}://${host}`;
  }

  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://spetly.app").replace(/\/$/, "");
}

export async function createPaidGalleryCheckoutAction(formData: FormData) {
  const galleryId = String(formData.get("galleryId") ?? "");
  const email = normalizeEmail(formData.get("email"));
  const name = normalizeName(formData.get("name"));

  if (!galleryId || !isValidEmail(email)) {
    redirect(`/g/${String(formData.get("gallerySlug") ?? "")}?purchase=invalid-email`);
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: {
      id: true,
      adminId: true,
      title: true,
      slug: true,
      isActive: true,
      galleryMode: true,
      deliveryMode: true,
      proofingStatus: true,
      salePriceCents: true,
      saleCurrency: true,
      admin: {
        select: {
          stripeConnectIntegration: {
            select: {
              stripeAccountId: true,
              chargesEnabled: true
            }
          }
        }
      },
      photos: {
        where: { isClientHidden: false, deliveryStage: PHOTO_DELIVERY_STAGE_FINAL },
        select: { id: true }
      }
    }
  });

  if (!gallery || !gallery.isActive) {
    redirect("/g/not-found?purchase=unavailable");
  }

  const failureBase = `/g/${gallery.slug}`;

  if (gallery.deliveryMode !== GALLERY_DELIVERY_PAID) {
    redirect(`${failureBase}?purchase=not-for-sale`);
  }

  if (isProofingGallery(gallery.galleryMode) && gallery.proofingStatus !== PROOFING_STATUS_DELIVERED) {
    redirect(`${failureBase}?purchase=proofing-pending`);
  }

  if (gallery.photos.length === 0) {
    redirect(`${failureBase}?purchase=no-photos`);
  }

  const stripe = gallery.admin.stripeConnectIntegration;

  if (!stripe?.chargesEnabled) {
    redirect(`${failureBase}?purchase=stripe-unavailable`);
  }

  const origin = await requestOrigin();
  const purchase = await prisma.galleryPurchase.create({
    data: {
      galleryId: gallery.id,
      adminId: gallery.adminId,
      email,
      name: name || null,
      stripeAccountId: stripe.stripeAccountId,
      amountTotal: gallery.salePriceCents,
      currency: normalizeSaleCurrency(gallery.saleCurrency),
      status: GALLERY_PURCHASE_PENDING
    },
    select: { id: true }
  });

  let checkoutUrl = "";

  try {
    const session = await createConnectedCheckoutSession({
      stripeAccountId: stripe.stripeAccountId,
      purchaseId: purchase.id,
      galleryId: gallery.id,
      adminId: gallery.adminId,
      galleryTitle: gallery.title,
      customerEmail: email,
      customerName: name,
      amountCents: gallery.salePriceCents,
      currency: normalizeSaleCurrency(gallery.saleCurrency),
      successUrl: `${origin}/g/${gallery.slug}?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/g/${gallery.slug}?purchase=cancelled`
    });

    if (!session.url) {
      throw new Error("Stripe Checkout did not return a redirect URL.");
    }

    await prisma.galleryPurchase.update({
      where: { id: purchase.id },
      data: { stripeCheckoutSessionId: session.id }
    });
    checkoutUrl = session.url;
  } catch (error) {
    await prisma.galleryPurchase.update({
      where: { id: purchase.id },
      data: {
        status: "failed",
        fulfillmentError: error instanceof Error ? error.message.slice(0, 500) : "Stripe Checkout failed."
      }
    });
    redirect(`${failureBase}?purchase=stripe-error`);
  }

  redirect(checkoutUrl);
}
