import { prisma } from "@/lib/prisma";
import { DEFAULT_GALLERY_DOWNLOAD_QUALITY, normalizeGalleryDownloadQuality, type GalleryDownloadQuality } from "@/lib/download-quality";
import { createZipPartRanges, enqueueGalleryZipJob, kickGalleryZipJobs, sendGalleryDownloadLinksForPackages } from "@/lib/jobs";
import { PHOTO_DELIVERY_STAGE_FINAL, PROOFING_STATUS_DELIVERED, isProofingGallery } from "@/lib/proofing";
import { paidPurchaseScope } from "@/lib/gallery-sales-shared";
import type { StripeCheckoutSession } from "@/lib/stripe-connect";

export const GALLERY_PURCHASE_PENDING = "pending";
export const GALLERY_PURCHASE_PAID = "paid";
export const GALLERY_PURCHASE_FAILED = "failed";
export const GALLERY_PURCHASE_EXPIRED = "expired";

const SALE_CURRENCIES = ["eur", "usd", "gbp", "chf"] as const;
export type GallerySaleCurrency = (typeof SALE_CURRENCIES)[number];

export function normalizeSaleCurrency(value: string | null | undefined): GallerySaleCurrency {
  const normalized = value?.trim().toLowerCase();

  return SALE_CURRENCIES.includes(normalized as GallerySaleCurrency) ? (normalized as GallerySaleCurrency) : "eur";
}

export function parseGallerySalePriceCents(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, "").replace(",", ".") ?? "";
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(parsed * 100));
}

export function formatGallerySalePrice(cents: number | null | undefined, currency: string | null | undefined, locale = "hu-HU") {
  const amount = Math.max(0, cents ?? 0) / 100;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalizeSaleCurrency(currency).toUpperCase()
  }).format(amount);
}

export async function fulfillPaidGalleryPurchase(purchaseId: string, quality: GalleryDownloadQuality = DEFAULT_GALLERY_DOWNLOAD_QUALITY) {
  const normalizedQuality = normalizeGalleryDownloadQuality(quality);
  const purchase = await prisma.galleryPurchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      email: true,
      status: true,
      downloadScope: true,
      fulfilledAt: true,
      gallery: {
        select: {
          id: true,
          isActive: true,
          galleryMode: true,
          proofingStatus: true,
          photos: {
            where: { isClientHidden: false, deliveryStage: PHOTO_DELIVERY_STAGE_FINAL },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              fileSize: true,
              mediaType: true
            }
          }
        }
      }
    }
  });

  if (!purchase) {
    throw new Error("Purchase was not found.");
  }

  if (purchase.status !== GALLERY_PURCHASE_PAID) {
    return { ok: false as const, reason: "not-paid" };
  }

  if (!purchase.gallery.isActive) {
    throw new Error("Gallery is not active.");
  }

  if (isProofingGallery(purchase.gallery.galleryMode) && purchase.gallery.proofingStatus !== PROOFING_STATUS_DELIVERED) {
    throw new Error("Final photos are not released yet.");
  }

  if (purchase.gallery.photos.length === 0) {
    throw new Error("Gallery does not contain downloadable photos.");
  }

  const scope = purchase.downloadScope ?? paidPurchaseScope(purchase.id);
  const existingPackages = await prisma.galleryDownloadPackage.findMany({
    where: {
      galleryId: purchase.gallery.id,
      scope,
      status: { in: ["pending", "processing", "completed", "failed"] }
    },
    orderBy: [{ partIndex: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      status: true,
      groupId: true,
      partIndex: true,
      partCount: true,
      downloadUrl: true
    }
  });

  let packages = existingPackages;

  if (packages.length === 0) {
    const ranges = createZipPartRanges(purchase.gallery.photos, normalizedQuality);
    const partCount = ranges.length;
    const groupId = partCount > 1 ? purchase.id : null;

    packages = await prisma.$transaction(
      ranges.map((range, partIndex) =>
        prisma.galleryDownloadPackage.create({
          data: {
            galleryId: purchase.gallery.id,
            scope,
            status: "pending",
            photoCount: purchase.gallery.photos.length,
            partIndex,
            partCount,
            photoOffset: range.offset,
            photoLimit: range.limit,
            groupId
          },
          select: {
            id: true,
            status: true,
            groupId: true,
            partIndex: true,
            partCount: true,
            downloadUrl: true
          }
        })
      )
    );
  }

  const packageIds = packages.map((downloadPackage) => downloadPackage.id);
  const existingDownloads = await prisma.galleryDownload.findMany({
    where: {
      galleryId: purchase.gallery.id,
      packageId: { in: packageIds },
      email: purchase.email
    },
    select: { packageId: true }
  });
  const existingDownloadPackageIds = new Set(existingDownloads.map((download) => download.packageId).filter(Boolean));
  const missingDownloadRows = packageIds.filter((packageId) => !existingDownloadPackageIds.has(packageId));

  if (missingDownloadRows.length > 0) {
    await prisma.galleryDownload.createMany({
      data: missingDownloadRows.map((packageId) => ({
        galleryId: purchase.gallery.id,
        packageId,
        email: purchase.email,
        status: "waiting"
      }))
    });
  }

  await prisma.galleryPurchase.update({
    where: { id: purchase.id },
    data: {
      downloadScope: scope,
      fulfilledAt: purchase.fulfilledAt ?? new Date(),
      fulfillmentError: null
    }
  });

  const pendingPackages = packages.filter((downloadPackage) => downloadPackage.status === "pending");
  const payloads = await Promise.all(
    pendingPackages.map(async (downloadPackage) => ({
      galleryId: purchase.gallery.id,
      packageId: downloadPackage.id,
      jobId: (await enqueueGalleryZipJob({ galleryId: purchase.gallery.id, packageId: downloadPackage.id })).id
    }))
  );

  if (payloads.length > 0) {
    await kickGalleryZipJobs(payloads);
  }

  const completedPackages = packages.filter((downloadPackage) => downloadPackage.status === "completed" && downloadPackage.downloadUrl);
  if (completedPackages.length === packages.length) {
    await sendGalleryDownloadLinksForPackages(packageIds);
  }

  return { ok: true as const, packageIds };
}

export async function markPaidGalleryPurchaseFromCheckoutSession(session: StripeCheckoutSession, connectedAccountId?: string | null) {
  const purchaseId = session.metadata?.purchaseId ?? session.client_reference_id;

  if (!purchaseId) {
    throw new Error("Stripe Checkout Session is missing purchase metadata.");
  }

  const purchase = await prisma.galleryPurchase.findUnique({
    where: { id: purchaseId },
    select: {
      id: true,
      stripeAccountId: true,
      amountTotal: true,
      currency: true
    }
  });

  if (!purchase) {
    throw new Error("Purchase was not found.");
  }

  if (connectedAccountId && connectedAccountId !== purchase.stripeAccountId) {
    throw new Error("Stripe account mismatch for purchase.");
  }

  const sessionAmountTotal = session.amount_total ?? purchase.amountTotal;
  const noCostCheckoutCompleted = sessionAmountTotal === 0 && session.payment_status === "no_payment_required";

  if (session.payment_status !== "paid" && !noCostCheckoutCompleted) {
    return { ok: false as const, reason: "not-paid" };
  }

  await prisma.galleryPurchase.update({
    where: { id: purchase.id },
    data: {
      status: GALLERY_PURCHASE_PAID,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: session.payment_intent ?? null,
      amountTotal: sessionAmountTotal,
      currency: normalizeSaleCurrency(session.currency ?? purchase.currency),
      paidAt: new Date(),
      fulfillmentError: null
    }
  });

  await fulfillPaidGalleryPurchase(purchase.id);

  return { ok: true as const, purchaseId: purchase.id };
}
