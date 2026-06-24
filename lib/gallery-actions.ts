"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { invalidatePublicGalleryDownloadPackages, PUBLIC_DOWNLOAD_SCOPE } from "@/lib/download-packages";
import { kickGalleryMediaProcessing } from "@/lib/media-processing";
import { enqueueGalleryZipJob, kickGalleryZipJobs, preparePublicGalleryZipPackages, sendGalleryDownloadLinksForPackage } from "@/lib/jobs";
import { normalizeSlug } from "@/lib/slug";
import { completePendingTwoFactorSignIn, hasAnyAdmin, refreshAdminSession, requireAdmin, signInAdmin, signOutAdmin } from "@/lib/auth";
import { notificationWhere } from "@/lib/admin-scope";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  GALLERY_MODE_FULL,
  GALLERY_MODE_PROOFING,
  PHOTO_DELIVERY_STAGE_FINAL,
  PHOTO_DELIVERY_STAGE_RAW,
  PROOFING_STATUSES,
  PROOFING_STATUS_DELIVERED,
  PROOFING_STATUS_NOT_OPENED,
  PROOFING_STATUS_PROCESSING,
  PROOFING_STATUS_SUBMITTED,
  type ProofingStatus,
  defaultPhotoDeliveryStageForGalleryMode,
  isProofingGallery,
  normalizePhotoDeliveryStage
} from "@/lib/proofing";
import { publicGalleryUrl, sendClientFinalDeliveryEmail, sendClientProofingInviteEmail } from "@/lib/email";
import {
  createManualGalleryZipObjectKey,
  createPresignedPhotoUploadUrl,
  createPhotoObjectKey,
  createPhotoVariantObjectKey,
  deleteGalleryObjects,
  deletePhotoObject,
  getPhotoPublicUrl,
  getR2KeyFromPublicUrl,
  isR2StorageEnabled,
  savePhotoObject
} from "@/lib/storage";
import { verifyTotpCode } from "@/lib/totp";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formDate(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    return null;
  }

  const date = new Date(`${value}T12:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function galleryModeFromForm(formData: FormData) {
  return formString(formData, "galleryMode") === GALLERY_MODE_PROOFING ? GALLERY_MODE_PROOFING : GALLERY_MODE_FULL;
}

async function requireGalleryAccess(galleryId: string) {
  const admin = await requireAdmin();
  const gallery = await prisma.gallery.findFirst({
    where: {
      id: galleryId,
      ...(admin.role === "super_admin" ? {} : { adminId: admin.id })
    },
    select: { id: true, slug: true, galleryMode: true, proofingStatus: true, clientEmail: true, clientAccessToken: true }
  });

  if (!gallery) {
    redirect("/admin/galleries");
  }

  return { admin, gallery };
}

function createClientAccessToken() {
  return randomBytes(24).toString("base64url");
}

const STALE_MEDIA_PROCESSING_MS = 2 * 60 * 60 * 1000;
const STALE_ZIP_PROCESSING_MS = 15 * 60 * 1000;

function readPositiveMegabytes(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback * 1024 * 1024;
  }

  return parsed * 1024 * 1024;
}

const ZIP_PART_TARGET_BYTES = readPositiveMegabytes(process.env.GALLERY_ZIP_PART_TARGET_MB, 2048, 256);

function createZipPartRanges(photos: Array<{ fileSize: number | null }>) {
  const ranges: Array<{ offset: number; limit: number }> = [];
  let offset = 0;
  let currentBytes = 0;
  let currentCount = 0;

  for (const photo of photos) {
    const size = photo.fileSize && photo.fileSize > 0 ? photo.fileSize : 25 * 1024 * 1024;

    if (currentCount > 0 && currentBytes + size > ZIP_PART_TARGET_BYTES) {
      ranges.push({ offset, limit: currentCount });
      offset += currentCount;
      currentBytes = 0;
      currentCount = 0;
    }

    currentBytes += size;
    currentCount += 1;
  }

  if (currentCount > 0) {
    ranges.push({ offset, limit: currentCount });
  }

  return ranges.length > 0 ? ranges : [{ offset: 0, limit: photos.length }];
}

function hasLightweightPhotoVariant(photo: { imageUrl: string; thumbnailUrl: string; previewUrl: string; mediaType: string }) {
  return (
    photo.mediaType !== "video" &&
    ((photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl) ||
      (photo.previewUrl && photo.previewUrl !== photo.imageUrl))
  );
}

function isRequeueableMediaPhoto(photo: {
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  mediaType: string;
  processingStatus: string;
  processingRequestedAt: Date | null;
}) {
  if (photo.mediaType === "video") {
    return false;
  }

  if (!hasLightweightPhotoVariant(photo)) {
    return true;
  }

  if (photo.processingStatus === "failed") {
    return true;
  }

  return (
    photo.processingStatus !== "ready" &&
    (!photo.processingRequestedAt || Date.now() - photo.processingRequestedAt.getTime() > STALE_MEDIA_PROCESSING_MS)
  );
}

function scheduleGalleryMediaProcessing(galleryId: string, { force = false }: { force?: boolean } = {}) {
  try {
    after(async () => {
      await kickGalleryMediaProcessing({ galleryId, force });
    });
  } catch {
    void kickGalleryMediaProcessing({ galleryId, force });
  }
}

async function sendProofingInviteForGallery(galleryId: string, { force = false }: { force?: boolean } = {}) {
  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: {
      title: true,
      slug: true,
      galleryMode: true,
      clientEmail: true,
      proofingInviteSentAt: true,
      proofingInviteSentTo: true
    }
  });

  if (!gallery || !isProofingGallery(gallery.galleryMode)) {
    return { ok: false, reason: "not-proofing" };
  }

  const recipient = normalizeEmail(gallery.clientEmail);

  if (!isValidEmail(recipient)) {
    return { ok: false, reason: "missing-email" };
  }

  if (!force && gallery.proofingInviteSentAt && gallery.proofingInviteSentTo === recipient) {
    return { ok: true, skipped: true };
  }

  try {
    const sent = await sendClientProofingInviteEmail({
      to: recipient,
      galleryTitle: gallery.title,
      proofingGalleryUrl: publicGalleryUrl(gallery.slug)
    });

    if (!sent) {
      await prisma.gallery.update({
        where: { id: galleryId },
        data: { proofingInviteEmailError: "Hiányzó email konfiguráció." }
      });
      return { ok: false, reason: "email-config" };
    }

    await prisma.gallery.update({
      where: { id: galleryId },
      data: {
        clientEmail: recipient,
        proofingInviteSentAt: new Date(),
        proofingInviteSentTo: recipient,
        proofingInviteEmailError: null
      }
    });

    return { ok: true, skipped: false };
  } catch (error) {
    await prisma.gallery.update({
      where: { id: galleryId },
      data: {
        proofingInviteEmailError: error instanceof Error ? error.message.slice(0, 500) : "Email küldési hiba."
      }
    });

    return { ok: false, reason: "send-failed" };
  }
}

async function sendFinalDeliveryEmailForGallery(galleryId: string, { force = false }: { force?: boolean } = {}) {
  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: {
      title: true,
      slug: true,
      galleryMode: true,
      clientEmail: true,
      downloadsEnabled: true,
      finalDeliveryEmailSentAt: true,
      finalDeliveryEmailSentTo: true
    }
  });

  if (!gallery || !isProofingGallery(gallery.galleryMode)) {
    return { ok: false, reason: "not-proofing" };
  }

  const recipient = normalizeEmail(gallery.clientEmail);

  if (!isValidEmail(recipient)) {
    await prisma.gallery.update({
      where: { id: galleryId },
      data: { finalDeliveryEmailError: "Hiányzó vagy érvénytelen ügyfél email cím." }
    });
    return { ok: false, reason: "missing-email" };
  }

  if (!force && gallery.finalDeliveryEmailSentAt && gallery.finalDeliveryEmailSentTo === recipient) {
    return { ok: true, skipped: true };
  }

  try {
    const sent = await sendClientFinalDeliveryEmail({
      to: recipient,
      galleryTitle: gallery.title,
      galleryUrl: publicGalleryUrl(gallery.slug),
      downloadsEnabled: gallery.downloadsEnabled
    });

    if (!sent) {
      await prisma.gallery.update({
        where: { id: galleryId },
        data: { finalDeliveryEmailError: "Hiányzó email konfiguráció." }
      });
      return { ok: false, reason: "email-config" };
    }

    await prisma.gallery.update({
      where: { id: galleryId },
      data: {
        finalDeliveryEmailSentAt: new Date(),
        finalDeliveryEmailSentTo: recipient,
        finalDeliveryEmailError: null
      }
    });

    return { ok: true, skipped: false };
  } catch (error) {
    await prisma.gallery.update({
      where: { id: galleryId },
      data: {
        finalDeliveryEmailError: error instanceof Error ? error.message.slice(0, 500) : "Email küldési hiba."
      }
    });

    return { ok: false, reason: "send-failed" };
  }
}

type PhotoUploadRequest = {
  clientId: string;
  filename: string;
  contentType?: string;
  mediaType?: "image" | "video";
  fileSize?: number;
  imageWidth?: number;
  imageHeight?: number;
  capturedAt?: string | null;
  originalIndex?: number;
};

type PhotoDuplicateMode = "skip" | "replace";

type CompletedPhotoUpload = {
  uploadItemId?: string;
  clientId?: string;
  filename: string;
  r2Key: string;
  imageUrl: string;
  thumbnailUrl: string;
  thumbnailR2Key?: string | null;
  previewUrl?: string;
  previewR2Key?: string | null;
  mediaType?: "image" | "video";
  fileSize?: number;
  imageWidth?: number;
  imageHeight?: number;
  capturedAt?: string | null;
  originalIndex?: number;
  replacePhotoId?: string | null;
};

function normalizePhotoDuplicateMode(value: string | null | undefined): PhotoDuplicateMode {
  return value === "replace" ? "replace" : "skip";
}

function photoDuplicateKey(input: {
  filename: string;
  mediaType?: string | null;
  fileSize?: number | null;
}) {
  return [
    input.mediaType === "video" ? "video" : "image",
    input.filename.trim(),
    input.fileSize ?? 0
  ].join("\u001F");
}

function photoObjectKeys(photo: {
  r2Key?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
}) {
  return [
    photo.r2Key,
    getR2KeyFromPublicUrl(photo.imageUrl),
    getR2KeyFromPublicUrl(photo.thumbnailUrl),
    getR2KeyFromPublicUrl(photo.previewUrl)
  ].filter((key): key is string => Boolean(key));
}

async function refreshUploadSessionCounts(sessionId: string) {
  const [uploadedCount, completedCount, failedCount] = await Promise.all([
    prisma.galleryUploadItem.count({
      where: {
        sessionId,
        status: { in: ["uploaded", "completed"] }
      }
    }),
    prisma.galleryUploadItem.count({
      where: {
        sessionId,
        status: "completed"
      }
    }),
    prisma.galleryUploadItem.count({
      where: {
        sessionId,
        status: "failed"
      }
    })
  ]);

  const session = await prisma.galleryUploadSession.findUnique({
    where: { id: sessionId },
    select: { totalCount: true }
  });
  const totalCount = session?.totalCount ?? 0;
  const status =
    completedCount >= totalCount && totalCount > 0
      ? "completed"
      : failedCount > 0
        ? "partial"
        : uploadedCount > 0
          ? "uploading"
          : "pending";

  await prisma.galleryUploadSession.update({
    where: { id: sessionId },
    data: {
      uploadedCount,
      completedCount,
      failedCount,
      status
    }
  });
}

async function incrementCompletedUploadSessionCounts(sessionId: string, completedCount: number) {
  if (completedCount <= 0) {
    const session = await prisma.galleryUploadSession.findUnique({
      where: { id: sessionId },
      select: {
        totalCount: true,
        completedCount: true,
        failedCount: true
      }
    });

    return session;
  }

  const session = await prisma.galleryUploadSession.update({
    where: { id: sessionId },
    data: {
      uploadedCount: { increment: completedCount },
      completedCount: { increment: completedCount }
    },
    select: {
      totalCount: true,
      completedCount: true,
      failedCount: true
    }
  });
  const status =
    session.completedCount >= session.totalCount && session.totalCount > 0
      ? "completed"
      : session.failedCount > 0
        ? "partial"
        : session.completedCount > 0
          ? "uploading"
          : "pending";

  await prisma.galleryUploadSession.update({
    where: { id: sessionId },
    data: { status }
  });

  return session;
}

async function reorderGalleryPhotosByCaptureTime(galleryId: string) {
  const photos = await prisma.photo.findMany({
    where: { galleryId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      mediaType: true,
      capturedAt: true,
      createdAt: true,
      sortOrder: true
    }
  });

  const reordered = photos.sort((a, b) => {
    if (a.mediaType !== b.mediaType) {
      return a.mediaType === "video" ? -1 : 1;
    }

    const aTime = a.capturedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTime = b.capturedAt?.getTime() ?? Number.POSITIVE_INFINITY;

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    if (a.createdAt.getTime() !== b.createdAt.getTime()) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }

    return a.sortOrder - b.sortOrder;
  });

  await prisma.$transaction(
    reordered.map((photo, index) =>
      prisma.photo.update({
        where: { id: photo.id },
        data: { sortOrder: index + 1 }
      })
    )
  );
}

export async function reorderGalleryPhotosAction(galleryId: string) {
  const { gallery } = await requireGalleryAccess(galleryId);

  await reorderGalleryPhotosByCaptureTime(galleryId);
  await invalidatePublicGalleryDownloadPackages(galleryId);

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${gallery.slug}`);
  revalidatePath(`/client/${gallery.slug}`);
  redirect(`/admin/galleries/${galleryId}?tab=photos&ordered=1`);
}

export async function loginAction(formData: FormData) {
  const email = formString(formData, "email");
  const password = formString(formData, "password");
  const twoFactorCode = formString(formData, "twoFactorCode");

  if (twoFactorCode && !email && !password) {
    const result = await completePendingTwoFactorSignIn(twoFactorCode);

    if (result === "success") {
      redirect("/admin/dashboard");
    }

    redirect("/admin/login?twoFactor=1&error=1");
  }

  const result = await signInAdmin(email, password);

  if (result === "pending") {
    redirect("/admin/login?approval=pending");
  }

  if (result === "two_factor_required") {
    redirect("/admin/login?twoFactor=1");
  }

  if (result !== "success") {
    redirect("/admin/login?error=1");
  }

  redirect("/admin/dashboard");
}

export async function registerAdminAction(formData: FormData) {
  const alreadyHasAdmin = await hasAnyAdmin();

  const name = formString(formData, "name");
  const email = formString(formData, "email").toLowerCase();
  const password = formString(formData, "password");
  const confirmPassword = formString(formData, "confirmPassword");

  if (!name || !email || !password || password.length < 8) {
    redirect("/admin/register?error=missing");
  }

  if (password !== confirmPassword) {
    redirect("/admin/register?error=password");
  }

  const passwordHash = await hashPassword(password);

  await prisma.admin.create({
    data: {
      name,
      email,
      passwordHash,
      role: alreadyHasAdmin ? "photographer" : "super_admin",
      status: alreadyHasAdmin ? "pending" : "approved",
      approvedAt: alreadyHasAdmin ? null : new Date()
    }
  });

  if (alreadyHasAdmin) {
    redirect("/admin/login?registered=pending");
  }

  await signInAdmin(email, password);
  redirect("/admin/dashboard");
}

export async function logoutAction() {
  await signOutAdmin();
  redirect("/admin/login");
}

export async function refreshAdminSessionAction() {
  const admin = await refreshAdminSession();
  return { ok: Boolean(admin) };
}

export async function enableTwoFactorAction(formData: FormData) {
  const admin = await requireAdmin();
  const secret = formString(formData, "secret").replace(/\s/g, "").toUpperCase();
  const code = formString(formData, "code");

  if (!secret || !verifyTotpCode(secret, code)) {
    redirect("/admin/security?error=code");
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: secret
    }
  });

  redirect("/admin/security?enabled=1");
}

export async function disableTwoFactorAction(formData: FormData) {
  const adminSession = await requireAdmin();
  const password = formString(formData, "password");

  const admin = await prisma.admin.findUnique({
    where: { id: adminSession.id },
    select: { passwordHash: true }
  });

  if (!admin || !password || !(await verifyPassword(password, admin.passwordHash))) {
    redirect("/admin/security?error=password");
  }

  await prisma.admin.update({
    where: { id: adminSession.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null
    }
  });

  redirect("/admin/security?disabled=1");
}

export async function markAllNotificationsReadAction() {
  const admin = await requireAdmin();

  await prisma.adminNotification.updateMany({
    where: { ...notificationWhere(admin), readAt: null },
    data: { readAt: new Date() }
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/notifications");
}

export async function generateClientAccessLinkAction(galleryId: string) {
  await requireGalleryAccess(galleryId);

  const gallery = await prisma.gallery.update({
    where: { id: galleryId },
    data: { clientAccessToken: createClientAccessToken() },
    select: { slug: true }
  });

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/client/${gallery.slug}`);
  redirect(`/admin/galleries/${galleryId}?clientLink=1`);
}

export async function sendProofingInviteAction(galleryId: string) {
  await requireGalleryAccess(galleryId);

  const result = await sendProofingInviteForGallery(galleryId, { force: true });
  const status = result.ok ? "sent" : result.reason === "missing-email" ? "missing-email" : "failed";

  revalidatePath(`/admin/galleries/${galleryId}`);
  redirect(`/admin/galleries/${galleryId}?tab=client&proofingInvite=${status}`);
}

export async function sendFinalDeliveryEmailAction(galleryId: string) {
  await requireGalleryAccess(galleryId);

  const result = await sendFinalDeliveryEmailForGallery(galleryId, { force: true });
  const status = result.ok ? "sent" : result.reason === "missing-email" ? "missing-email" : "failed";

  revalidatePath(`/admin/galleries/${galleryId}`);
  redirect(`/admin/galleries/${galleryId}?tab=client&deliveryEmail=${status}`);
}

export async function restoreClientHiddenPhotoAction(galleryId: string, photoId: string) {
  await requireGalleryAccess(galleryId);

  const photo = await prisma.photo.findFirst({
    where: { id: photoId, galleryId },
    select: {
      gallery: {
        select: { slug: true }
      }
    }
  });

  if (!photo) {
    redirect(`/admin/galleries/${galleryId}?photoError=missing`);
  }

  await prisma.photo.update({
    where: { id: photoId },
    data: {
      isClientHidden: false,
      clientHiddenAt: null
    }
  });
  await invalidatePublicGalleryDownloadPackages(galleryId);

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${photo.gallery.slug}`);
  revalidatePath(`/client/${photo.gallery.slug}`);
  redirect(`/admin/galleries/${galleryId}?clientRestored=1`);
}

export async function updateGalleryProofingStatusAction(galleryId: string, status: ProofingStatus) {
  await requireGalleryAccess(galleryId);

  if (!PROOFING_STATUSES.some((item) => item.key === status)) {
    redirect(`/admin/galleries/${galleryId}?tab=client&error=proofing-status`);
  }

  if (status === PROOFING_STATUS_DELIVERED) {
    const [galleryBeforeDelivery, finalPhotoCount] = await Promise.all([
      prisma.gallery.findUnique({
        where: { id: galleryId },
        select: { clientEmail: true }
      }),
      prisma.photo.count({
        where: {
          galleryId,
          deliveryStage: PHOTO_DELIVERY_STAGE_FINAL
        }
      })
    ]);

    if (finalPhotoCount === 0) {
      redirect(`/admin/galleries/${galleryId}?tab=client&deliveryEmail=no-final-photos`);
    }

    const recipient = normalizeEmail(galleryBeforeDelivery?.clientEmail);

    if (!isValidEmail(recipient)) {
      await prisma.gallery.update({
        where: { id: galleryId },
        data: { finalDeliveryEmailError: "Hiányzó vagy érvénytelen ügyfél email cím." }
      });
      redirect(`/admin/galleries/${galleryId}?tab=client&deliveryEmail=missing-email`);
    }
  }

  const gallery = await prisma.gallery.update({
    where: { id: galleryId },
    data: {
      galleryMode: GALLERY_MODE_PROOFING,
      proofingStatus: status,
      proofingStatusUpdatedAt: new Date()
    },
    select: { slug: true, galleryMode: true }
  });

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${gallery.slug}`);

  if (status === PROOFING_STATUS_DELIVERED && isProofingGallery(gallery.galleryMode)) {
    await invalidatePublicGalleryDownloadPackages(galleryId);
    const zipResult = await preparePublicGalleryZipPackages(galleryId);
    const zipStatus = zipResult.ok ? (zipResult.cached ? "already-ready" : "queued") : zipResult.reason;

    if (zipResult.ok && zipResult.payloads.length > 0) {
      after(async () => {
        await kickGalleryZipJobs(zipResult.payloads);
      });
    }

    const emailResult = await sendFinalDeliveryEmailForGallery(galleryId);
    const deliveryEmail = emailResult.ok ? "sent" : emailResult.reason === "missing-email" ? "missing-email" : "failed";

    redirect(`/admin/galleries/${galleryId}?tab=client&proofingStatus=1&deliveryEmail=${deliveryEmail}&zip=${zipStatus}`);
  }

  redirect(`/admin/galleries/${galleryId}?tab=client&proofingStatus=1`);
}

export async function createGalleryAction(formData: FormData) {
  const admin = await requireAdmin();

  const customerId = formString(formData, "customerId");
  const projectId = formString(formData, "projectId");
  const title = formString(formData, "title");
  const rawSlug = formString(formData, "slug");
  const password = formString(formData, "password");
  const submittedEventDate = formDate(formData, "eventDate");
  const slug = normalizeSlug(rawSlug || title);
  const isActive = formData.get("isActive") === "on";
  const galleryMode = galleryModeFromForm(formData);
  const downloadsEnabled = formData.get("downloadsEnabled") === "on";

  if (!title || !slug || !customerId) {
    redirect("/admin/galleries/new?error=missing");
  }

  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      ...(admin.role === "super_admin" ? {} : { adminId: admin.id })
    },
    select: {
      id: true,
      primaryEmail: true,
      weddingDate: true
    }
  });

  if (!customer) {
    redirect("/admin/galleries/new?error=customer");
  }

  const project = projectId
    ? await prisma.customerProject.findFirst({
        where: {
          id: projectId,
          customerId: customer.id,
          ...(admin.role === "super_admin" ? {} : { customer: { adminId: admin.id } })
        },
        select: {
          id: true,
          eventDate: true
        }
      })
    : null;

  if (projectId && !project) {
    redirect("/admin/galleries/new?error=project");
  }

  const eventDate = submittedEventDate ?? project?.eventDate ?? customer.weddingDate;
  let gallery;

  try {
    gallery = await prisma.gallery.create({
      data: {
        title,
        slug,
        adminId: admin.id,
        customerId: customer.id,
        projectId: project?.id ?? null,
        password: password || null,
        eventDate,
        isActive,
        galleryMode,
        proofingStatus: PROOFING_STATUS_NOT_OPENED,
        proofingStatusUpdatedAt: isProofingGallery(galleryMode) ? new Date() : null,
        downloadsEnabled,
        clientEmail: normalizeEmail(customer.primaryEmail),
        clientAccessToken: createClientAccessToken()
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/admin/galleries/new?error=slug");
    }

    throw error;
  }

  revalidatePath("/admin/galleries");
  revalidatePath("/admin/clients");
  revalidatePath(`/admin/clients/${customer.id}`);
  redirect(`/admin/galleries/${gallery.id}`);
}

export async function updateGalleryAction(id: string, formData: FormData) {
  const { admin } = await requireGalleryAccess(id);

  const customerId = formString(formData, "customerId");
  const projectId = formString(formData, "projectId");
  const title = formString(formData, "title");
  const rawSlug = formString(formData, "slug");
  const password = formString(formData, "password");
  const eventDate = formDate(formData, "eventDate");
  const slug = normalizeSlug(rawSlug || title);
  const isActive = formData.get("isActive") === "on";
  const galleryMode = galleryModeFromForm(formData);
  const downloadsEnabled = formData.get("downloadsEnabled") === "on";

  if (!title || !slug) {
    redirect(`/admin/galleries/${id}?error=missing`);
  }

  const selectedCustomer = customerId
    ? await prisma.customer.findFirst({
        where: {
          id: customerId,
          ...(admin.role === "super_admin" ? {} : { adminId: admin.id })
        },
        select: {
          id: true,
          primaryEmail: true
        }
      })
    : null;

  if (customerId && !selectedCustomer) {
    redirect(`/admin/galleries/${id}?error=customer`);
  }

  const selectedProject = projectId
    ? await prisma.customerProject.findFirst({
        where: {
          id: projectId,
          customerId: selectedCustomer?.id ?? "",
          ...(admin.role === "super_admin" ? {} : { customer: { adminId: admin.id } })
        },
        select: {
          id: true
        }
      })
    : null;

  if (projectId && !selectedProject) {
    redirect(`/admin/galleries/${id}?error=project`);
  }

  let previousSlug = slug;
  let previousCustomerId: string | null = null;

  try {
    const previousGallery = await prisma.gallery.findFirst({
      where: { id },
      select: { slug: true, galleryMode: true, clientEmail: true, customerId: true }
    });

    previousSlug = previousGallery?.slug ?? slug;
    previousCustomerId = previousGallery?.customerId ?? null;
    const becameProofing = !isProofingGallery(previousGallery?.galleryMode) && isProofingGallery(galleryMode);

    await prisma.gallery.update({
      where: { id },
      data: {
        title,
        slug,
        customerId: selectedCustomer?.id ?? null,
        projectId: selectedProject?.id ?? null,
        password: password || null,
        eventDate,
        isActive,
        galleryMode,
        clientEmail: selectedCustomer ? normalizeEmail(selectedCustomer.primaryEmail) : previousGallery?.clientEmail ?? null,
        proofingInviteEmailError: null,
        finalDeliveryEmailError: null,
        ...(becameProofing
          ? {
              proofingStatus: PROOFING_STATUS_NOT_OPENED,
              proofingStatusUpdatedAt: new Date()
            }
          : {}),
        downloadsEnabled
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`/admin/galleries/${id}?error=slug`);
    }

    throw error;
  }

  revalidatePath("/admin/galleries");
  revalidatePath("/admin/clients");
  if (previousCustomerId) {
    revalidatePath(`/admin/clients/${previousCustomerId}`);
  }
  if (selectedCustomer?.id) {
    revalidatePath(`/admin/clients/${selectedCustomer.id}`);
  }
  revalidatePath(`/g/${previousSlug}`);
  revalidatePath(`/g/${slug}`);

  redirect(`/admin/galleries/${id}?saved=1`);
}

export async function archiveGalleryAction(id: string) {
  await requireGalleryAccess(id);

  const gallery = await prisma.gallery.update({
    where: { id },
    data: { isActive: false },
    select: { slug: true }
  });

  revalidatePath("/admin/galleries");
  revalidatePath(`/admin/galleries/${id}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/galleries/${id}?archived=1`);
}

export async function activateGalleryAction(id: string) {
  await requireGalleryAccess(id);

  const gallery = await prisma.gallery.update({
    where: { id },
    data: { isActive: true },
    select: { slug: true }
  });

  revalidatePath("/admin/galleries");
  revalidatePath(`/admin/galleries/${id}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/galleries/${id}?activated=1`);
}

export async function deleteGalleryAction(id: string) {
  await requireGalleryAccess(id);

  const gallery = await prisma.gallery.findUnique({
    where: { id },
    select: {
      slug: true,
      photos: {
        select: { r2Key: true, thumbnailUrl: true, previewUrl: true }
      }
    }
  });

  if (!gallery) {
    redirect("/admin/galleries");
  }

  await prisma.gallery.delete({
    where: { id }
  });

  await deleteGalleryObjects(
    gallery.slug,
    gallery.photos.flatMap((photo) => [
      photo.r2Key,
      getR2KeyFromPublicUrl(photo.thumbnailUrl),
      getR2KeyFromPublicUrl(photo.previewUrl)
    ])
  );

  revalidatePath("/admin/galleries");
  revalidatePath(`/g/${gallery.slug}`);
  redirect("/admin/galleries?deleted=1");
}

export async function addPhotoAction(galleryId: string, formData: FormData) {
  const { gallery } = await requireGalleryAccess(galleryId);
  const deliveryStage = defaultPhotoDeliveryStageForGalleryMode(gallery.galleryMode);

  const uploads = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (uploads.length === 0) {
    redirect(`/admin/galleries/${galleryId}?photoError=missing`);
  }

  const latestPhoto = await prisma.photo.findFirst({
    where: { galleryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });
  const nextSortOrder = (latestPhoto?.sortOrder ?? 0) + 1;

  const createdPhotos = await Promise.all(
    uploads.map(async (file, index) => {
      const r2Key = createPhotoObjectKey({
        gallerySlug: gallery.slug,
        originalFilename: file.name
      });
      const bytes = Buffer.from(await file.arrayBuffer());
      const publicUrl = getPhotoPublicUrl(r2Key);

      try {
        await savePhotoObject({
          r2Key,
          bytes,
          contentType: file.type
        });
      } catch (error) {
        console.error("Photo upload failed", {
          galleryId,
          r2Key,
          storageDriver: process.env.STORAGE_DRIVER,
          error
        });
        redirect(`/admin/galleries/${galleryId}?photoError=storage`);
      }

      return {
        galleryId,
        filename: file.name,
        r2Key,
        imageUrl: publicUrl,
        thumbnailUrl: publicUrl,
        previewUrl: publicUrl,
        deliveryStage,
        fileSize: bytes.length,
        sortOrder: nextSortOrder + index
      };
    })
  );

  await prisma.photo.createMany({
    data: createdPhotos
  });

  await reorderGalleryPhotosByCaptureTime(galleryId);

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/galleries/${galleryId}?photoAdded=1`);
}

export async function createPhotoUploadSessionAction(
  galleryId: string,
  totalCount: number,
  deliveryStage?: string,
  clientEmail?: string
): Promise<{ ok: boolean; message?: string; sessionId: string | null }> {
  const { gallery } = await requireGalleryAccess(galleryId);
  const normalizedDeliveryStage = isProofingGallery(gallery.galleryMode)
    ? normalizePhotoDeliveryStage(deliveryStage)
    : PHOTO_DELIVERY_STAGE_FINAL;
  const proofingRawUpload = isProofingGallery(gallery.galleryMode) && normalizedDeliveryStage === PHOTO_DELIVERY_STAGE_RAW;
  const normalizedClientEmail = normalizeEmail(clientEmail ?? gallery.clientEmail);

  if (proofingRawUpload && !isValidEmail(normalizedClientEmail)) {
    return {
      ok: false,
      message: "Adj meg egy érvényes ügyfél email címet a galéria adatai között, hogy ki tudjuk küldeni a válogató linket.",
      sessionId: null
    };
  }

  const latestPhoto = await prisma.photo.findFirst({
    where: { galleryId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });

  if (proofingRawUpload) {
    await prisma.gallery.update({
      where: { id: galleryId },
      data: {
        clientEmail: normalizedClientEmail,
        proofingInviteEmailError: null
      }
    });
  }

  const session = await prisma.galleryUploadSession.create({
    data: {
      galleryId,
      deliveryStage: normalizedDeliveryStage,
      totalCount: Math.max(0, totalCount),
      baseSortOrder: (latestPhoto?.sortOrder ?? 0) + 1,
      status: "pending"
    },
    select: { id: true }
  });

  return {
    ok: true,
    sessionId: session.id
  };
}

export async function createPhotoUploadTargetsAction(
  galleryId: string,
  sessionId: string,
  files: PhotoUploadRequest[],
  duplicateMode: PhotoDuplicateMode = "skip"
) {
  await requireGalleryAccess(galleryId);

  if (!isR2StorageEnabled()) {
    return {
      ok: false,
      message: "A közvetlen feltöltés csak R2 storage módban érhető el."
    };
  }

  const session = await prisma.galleryUploadSession.findFirst({
    where: { id: sessionId, galleryId },
    select: {
      id: true,
      deliveryStage: true,
      gallery: {
        select: {
          slug: true
        }
      }
    }
  });

  if (!session) {
    return {
      ok: false,
      message: "A feltöltési munkamenet nem található."
    };
  }

  const validFiles = files.filter((file) => file.clientId.trim() && file.filename.trim());

  if (validFiles.length === 0) {
    return {
      ok: false,
      message: "Nem választottál ki fotót."
    };
  }

  try {
    const normalizedDuplicateMode = normalizePhotoDuplicateMode(duplicateMode);
    const normalizedFiles = validFiles.map((file) => ({
      ...file,
      mediaType: file.mediaType === "video" || file.contentType?.startsWith("video/") ? "video" : "image"
    }));
    const existingPhotos = await prisma.photo.findMany({
      where: {
        galleryId,
        deliveryStage: session.deliveryStage,
        filename: { in: Array.from(new Set(normalizedFiles.map((file) => file.filename))) }
      },
      orderBy: [{ createdAt: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        filename: true,
        r2Key: true,
        imageUrl: true,
        thumbnailUrl: true,
        previewUrl: true,
        mediaType: true,
        fileSize: true,
        imageWidth: true,
        imageHeight: true,
        capturedAt: true
      }
    });
    const existingUploadItems = await prisma.galleryUploadItem.findMany({
      where: {
        sessionId: session.id,
        filename: { in: Array.from(new Set(normalizedFiles.map((file) => file.filename))) }
      },
      orderBy: [{ completedAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        status: true,
        filename: true,
        r2Key: true,
        imageUrl: true,
        thumbnailUrl: true,
        previewUrl: true,
        mediaType: true,
        fileSize: true,
        imageWidth: true,
        imageHeight: true,
        capturedAt: true
      }
    });
    const existingPhotoByKey = new Map<string, (typeof existingPhotos)[number]>();
    const existingUploadItemByKey = new Map<string, (typeof existingUploadItems)[number]>();

    for (const photo of existingPhotos) {
      const key = photoDuplicateKey(photo);

      if (!existingPhotoByKey.has(key)) {
        existingPhotoByKey.set(key, photo);
      }
    }

    for (const item of existingUploadItems) {
      const key = photoDuplicateKey(item);

      if (!existingUploadItemByKey.has(key)) {
        existingUploadItemByKey.set(key, item);
      }
    }

    const uploads = await Promise.all(
      normalizedFiles.map(async (file) => {
        const mediaType = file.mediaType;
        const fileDuplicateKey = photoDuplicateKey(file);
        const existingUploadItem = existingUploadItemByKey.get(fileDuplicateKey);
        const existingPhoto = existingPhotoByKey.get(fileDuplicateKey);

        if (existingUploadItem?.status === "completed" && existingUploadItem.r2Key && existingUploadItem.imageUrl) {
          return {
            uploadItemId: existingUploadItem.id,
            clientId: file.clientId,
            filename: file.filename,
            r2Key: existingUploadItem.r2Key,
            imageUrl: existingUploadItem.imageUrl,
            thumbnailUrl: existingUploadItem.thumbnailUrl || existingUploadItem.imageUrl,
            previewUrl: existingUploadItem.previewUrl || existingUploadItem.imageUrl,
            thumbnailR2Key: null,
            previewR2Key: null,
            mediaType,
            alreadyCompleted: true,
            replacePhotoId: null,
            uploadUrl: ""
          };
        }

        if (existingPhoto && normalizedDuplicateMode === "skip") {
          const now = new Date();
          const completedUploadItemData = {
            filename: file.filename,
            deliveryStage: session.deliveryStage,
            r2Key: existingPhoto.r2Key,
            imageUrl: existingPhoto.imageUrl,
            thumbnailUrl: existingPhoto.thumbnailUrl,
            previewUrl: existingPhoto.previewUrl,
            mediaType,
            fileSize: file.fileSize ?? 0,
            imageWidth: file.imageWidth ?? 0,
            imageHeight: file.imageHeight ?? 0,
            capturedAt: file.capturedAt ? new Date(file.capturedAt) : null,
            originalIndex: file.originalIndex ?? 0,
            status: "completed",
            errorMessage: null,
            uploadedAt: now,
            completedAt: now
          };
          const uploadItem = existingUploadItem
            ? await prisma.galleryUploadItem.update({
                where: { id: existingUploadItem.id },
                data: completedUploadItemData,
                select: {
                  id: true
                }
              })
            : await prisma.galleryUploadItem.upsert({
                where: {
                  sessionId_clientId: {
                    sessionId: session.id,
                    clientId: file.clientId
                  }
                },
                create: {
                  sessionId: session.id,
                  clientId: file.clientId,
                  ...completedUploadItemData
                },
                update: completedUploadItemData,
                select: {
                  id: true
                }
              });

          return {
            uploadItemId: uploadItem.id,
            clientId: file.clientId,
            filename: file.filename,
            r2Key: existingPhoto.r2Key,
            imageUrl: existingPhoto.imageUrl,
            thumbnailUrl: existingPhoto.thumbnailUrl || existingPhoto.imageUrl,
            previewUrl: existingPhoto.previewUrl || existingPhoto.imageUrl,
            thumbnailR2Key: null,
            previewR2Key: null,
            mediaType,
            alreadyCompleted: true,
            replacePhotoId: null,
            uploadUrl: ""
          };
        }

        const generatedR2Key = createPhotoObjectKey({
          gallerySlug: session.gallery.slug,
          originalFilename: file.filename
        });
        const generatedThumbnailR2Key =
          mediaType === "image"
            ? createPhotoVariantObjectKey({
                gallerySlug: session.gallery.slug,
                originalFilename: file.filename,
                variant: "thumbnail"
              })
            : null;
        const generatedPreviewR2Key =
          mediaType === "image"
            ? createPhotoVariantObjectKey({
                gallerySlug: session.gallery.slug,
                originalFilename: file.filename,
                variant: "preview"
              })
            : null;
        const generatedPublicUrl = getPhotoPublicUrl(generatedR2Key);
        const uploadingUploadItemData = {
          filename: file.filename,
          deliveryStage: session.deliveryStage,
          r2Key: generatedR2Key,
          imageUrl: generatedPublicUrl,
          thumbnailUrl: generatedPublicUrl,
          previewUrl: generatedPublicUrl,
          mediaType,
          fileSize: file.fileSize ?? 0,
          imageWidth: file.imageWidth ?? 0,
          imageHeight: file.imageHeight ?? 0,
          capturedAt: file.capturedAt ? new Date(file.capturedAt) : null,
          originalIndex: file.originalIndex ?? 0,
          status: "uploading",
          errorMessage: null,
          uploadedAt: null,
          completedAt: null
        };
        const uploadItem = existingUploadItem
          ? await prisma.galleryUploadItem.update({
              where: { id: existingUploadItem.id },
              data: uploadingUploadItemData,
              select: {
                id: true,
                r2Key: true,
                imageUrl: true,
                thumbnailUrl: true,
                previewUrl: true
              }
            })
          : await prisma.galleryUploadItem.upsert({
              where: {
                sessionId_clientId: {
                  sessionId: session.id,
                  clientId: file.clientId
                }
              },
              create: {
                sessionId: session.id,
                clientId: file.clientId,
                ...uploadingUploadItemData
              },
              update: uploadingUploadItemData,
              select: {
                id: true,
                r2Key: true,
                imageUrl: true,
                thumbnailUrl: true,
                previewUrl: true
              }
            });
        const r2Key = uploadItem.r2Key ?? generatedR2Key;
        const imageUrl = uploadItem.imageUrl ?? getPhotoPublicUrl(r2Key);
        const thumbnailUrl = uploadItem.thumbnailUrl ?? imageUrl;
        const previewUrl = uploadItem.previewUrl ?? imageUrl;

        return {
          uploadItemId: uploadItem.id,
          clientId: file.clientId,
          filename: file.filename,
          r2Key,
          imageUrl,
          thumbnailUrl,
          previewUrl,
          thumbnailR2Key: generatedThumbnailR2Key,
          previewR2Key: generatedPreviewR2Key,
          mediaType,
          alreadyCompleted: false,
          replacePhotoId: existingPhoto && normalizedDuplicateMode === "replace" ? existingPhoto.id : null,
          uploadUrl: await createPresignedPhotoUploadUrl({
            r2Key,
            contentType: file.contentType
          })
        };
      })
    );

    await refreshUploadSessionCounts(session.id);

    return {
      ok: true,
      uploads
    };
  } catch (error) {
    console.error("Photo upload target creation failed", {
      galleryId,
      storageDriver: process.env.STORAGE_DRIVER,
      error
    });

    return {
      ok: false,
      message: "Nem sikerült előkészíteni az R2 feltöltést."
    };
  }
}

export async function markPhotoUploadItemFailedAction({
  galleryId,
  sessionId,
  uploadItemId,
  message
}: {
  galleryId: string;
  sessionId: string;
  uploadItemId: string;
  message: string;
}) {
  await requireGalleryAccess(galleryId);

  const item = await prisma.galleryUploadItem.findFirst({
    where: {
      id: uploadItemId,
      sessionId,
      session: { galleryId }
    },
    select: { id: true }
  });

  if (!item) {
    return { ok: false };
  }

  await prisma.galleryUploadItem.update({
    where: { id: item.id },
    data: {
      status: "failed",
      errorMessage: message.slice(0, 500)
    }
  });
  await refreshUploadSessionCounts(sessionId);

  return { ok: true };
}

export async function completePhotoUploadsAction(
  galleryId: string,
  sessionId: string,
  uploads: CompletedPhotoUpload[],
  options: { revalidate?: boolean } = {}
) {
  await requireGalleryAccess(galleryId);

  const session = await prisma.galleryUploadSession.findFirst({
    where: { id: sessionId, galleryId },
    select: {
      id: true,
      baseSortOrder: true,
      deliveryStage: true,
      gallery: {
        select: {
          slug: true,
          galleryMode: true,
          proofingStatus: true
        }
      }
    }
  });

  if (!session) {
    return {
      ok: false,
      message: "A feltöltési munkamenet nem található."
    };
  }

  const validUploads = uploads.filter((upload) => upload.uploadItemId && upload.filename && upload.r2Key && upload.imageUrl);

  if (validUploads.length === 0) {
    return {
      ok: false,
      message: "Nincs menthető feltöltés."
    };
  }

  const uploadItemIds = validUploads.map((upload) => upload.uploadItemId).filter((id): id is string => Boolean(id));
  const uploadItems = await prisma.galleryUploadItem.findMany({
    where: {
      id: { in: uploadItemIds },
      sessionId: session.id
    },
    select: {
      id: true,
      status: true
    }
  });
  const completableItemIds = new Set(
    uploadItems.filter((item) => item.status !== "completed").map((item) => item.id)
  );

  const sortedUploads = validUploads.filter((upload) => upload.uploadItemId && completableItemIds.has(upload.uploadItemId)).sort((a, b) => {
    const aType = a.mediaType === "video" ? "video" : "image";
    const bType = b.mediaType === "video" ? "video" : "image";

    if (aType !== bType) {
      return aType === "video" ? -1 : 1;
    }

    const aTime = a.capturedAt ? Date.parse(a.capturedAt) : Number.POSITIVE_INFINITY;
    const bTime = b.capturedAt ? Date.parse(b.capturedAt) : Number.POSITIVE_INFINITY;

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return (a.originalIndex ?? 0) - (b.originalIndex ?? 0);
  });

  if (sortedUploads.length > 0) {
    const now = new Date();
    const replacementPhotoIds = Array.from(
      new Set(sortedUploads.map((upload) => upload.replacePhotoId).filter((id): id is string => Boolean(id)))
    );
    const replacementPhotos = replacementPhotoIds.length
      ? await prisma.photo.findMany({
          where: {
            id: { in: replacementPhotoIds },
            galleryId,
            deliveryStage: session.deliveryStage
          },
          select: {
            id: true,
            r2Key: true,
            imageUrl: true,
            thumbnailUrl: true,
            previewUrl: true,
            sortOrder: true
          }
        })
      : [];
    const replacementPhotoById = new Map(replacementPhotos.map((photo) => [photo.id, photo]));
    const usedReplacementPhotoIds = new Set<string>();
    const uploadsToReplace = sortedUploads.filter((upload) => {
      if (!upload.replacePhotoId || !replacementPhotoById.has(upload.replacePhotoId) || usedReplacementPhotoIds.has(upload.replacePhotoId)) {
        return false;
      }

      usedReplacementPhotoIds.add(upload.replacePhotoId);
      return true;
    });
    const replacementUploadItemIds = new Set(
      uploadsToReplace.map((upload) => upload.uploadItemId).filter((id): id is string => Boolean(id))
    );
    const creationCandidates = sortedUploads.filter((upload) => !upload.uploadItemId || !replacementUploadItemIds.has(upload.uploadItemId));
    const existingPhotos = creationCandidates.length
      ? await prisma.photo.findMany({
          where: {
            galleryId,
            deliveryStage: session.deliveryStage,
            filename: { in: Array.from(new Set(creationCandidates.map((upload) => upload.filename))) }
          },
          select: {
            filename: true,
            mediaType: true,
            fileSize: true
          }
        })
      : [];
    const existingPhotoKeys = new Set(existingPhotos.map((photo) => photoDuplicateKey(photo)));
    const batchPhotoKeys = new Set<string>();
    const uploadsToCreate = creationCandidates.filter((upload) => {
      const key = photoDuplicateKey(upload);

      if (existingPhotoKeys.has(key) || batchPhotoKeys.has(key)) {
        return false;
      }

      batchPhotoKeys.add(key);
      return true;
    });
    const createdPhotos = uploadsToCreate.map((upload) => {
      const id = randomUUID();
      const mediaType = upload.mediaType === "video" ? "video" : "image";
      const thumbnailUrl = upload.thumbnailUrl || upload.imageUrl;
      const previewUrl = upload.previewUrl || upload.imageUrl;

      return {
        id,
        galleryId,
        filename: upload.filename,
        r2Key: upload.r2Key,
        imageUrl: upload.imageUrl,
        thumbnailUrl,
        previewUrl,
        deliveryStage: session.deliveryStage,
        mediaType,
        processingStatus: "pending",
        processingRequestedAt: now,
        fileSize: upload.fileSize ?? 0,
        imageWidth: upload.imageWidth ?? 0,
        imageHeight: upload.imageHeight ?? 0,
        capturedAt: upload.capturedAt ? new Date(upload.capturedAt) : null,
        sortOrder: session.baseSortOrder + (upload.originalIndex ?? 0),
        thumbnailR2Key: upload.thumbnailR2Key ?? null,
        previewR2Key: upload.previewR2Key ?? null
      };
    });
    const replacedPhotos = uploadsToReplace.map((upload) => {
      const id = upload.replacePhotoId!;
      const existingPhoto = replacementPhotoById.get(id)!;
      const mediaType = upload.mediaType === "video" ? "video" : "image";
      const thumbnailUrl = upload.thumbnailUrl || upload.imageUrl;
      const previewUrl = upload.previewUrl || upload.imageUrl;

      return {
        id,
        galleryId,
        filename: upload.filename,
        r2Key: upload.r2Key,
        imageUrl: upload.imageUrl,
        thumbnailUrl,
        previewUrl,
        deliveryStage: session.deliveryStage,
        mediaType,
        processingStatus: "pending",
        processingRequestedAt: now,
        fileSize: upload.fileSize ?? 0,
        imageWidth: upload.imageWidth ?? 0,
        imageHeight: upload.imageHeight ?? 0,
        capturedAt: upload.capturedAt ? new Date(upload.capturedAt) : null,
        sortOrder: existingPhoto.sortOrder,
        thumbnailR2Key: upload.thumbnailR2Key ?? null,
        previewR2Key: upload.previewR2Key ?? null,
        previousObjectKeys: photoObjectKeys(existingPhoto)
      };
    });
    const photosForProcessing = [...createdPhotos, ...replacedPhotos];

    await prisma.$transaction(async (tx) => {
      if (createdPhotos.length > 0) {
        await tx.photo.createMany({
          data: createdPhotos.map((photo) => ({
            id: photo.id,
            galleryId: photo.galleryId,
            filename: photo.filename,
            r2Key: photo.r2Key,
            imageUrl: photo.imageUrl,
            thumbnailUrl: photo.thumbnailUrl,
            previewUrl: photo.previewUrl,
            deliveryStage: photo.deliveryStage,
            mediaType: photo.mediaType,
            processingStatus: photo.processingStatus,
            processingRequestedAt: photo.processingRequestedAt,
            fileSize: photo.fileSize,
            imageWidth: photo.imageWidth,
            imageHeight: photo.imageHeight,
            capturedAt: photo.capturedAt,
            sortOrder: photo.sortOrder
          }))
        });
      }

      for (const photo of replacedPhotos) {
        await tx.photo.update({
          where: { id: photo.id },
          data: {
            filename: photo.filename,
            r2Key: photo.r2Key,
            imageUrl: photo.imageUrl,
            thumbnailUrl: photo.thumbnailUrl,
            previewUrl: photo.previewUrl,
            mediaType: photo.mediaType,
            processingStatus: photo.processingStatus,
            processingError: null,
            processingRequestedAt: photo.processingRequestedAt,
            processingCompletedAt: null,
            fileSize: photo.fileSize,
            imageWidth: photo.imageWidth,
            imageHeight: photo.imageHeight,
            capturedAt: photo.capturedAt
          }
        });
      }

      await tx.galleryUploadItem.updateMany({
        where: {
          id: { in: sortedUploads.map((upload) => upload.uploadItemId).filter((id): id is string => Boolean(id)) },
          sessionId: session.id
        },
        data: {
          status: "completed",
          errorMessage: null,
          uploadedAt: new Date(),
          completedAt: new Date()
        }
      });

      if (replacedPhotos.length > 0) {
        await tx.mediaProcessingJob.deleteMany({
          where: { photoId: { in: replacedPhotos.map((photo) => photo.id) } }
        });
      }

      if (photosForProcessing.length > 0) {
        await tx.mediaProcessingJob.createMany({
          data: photosForProcessing.map((photo) => ({
            galleryId: photo.galleryId,
            photoId: photo.id,
            mediaType: photo.mediaType,
            sourceR2Key: photo.r2Key,
            thumbnailR2Key: photo.thumbnailR2Key,
            previewR2Key: photo.previewR2Key,
            posterR2Key: photo.mediaType === "video" ? `galleries/${session.gallery.slug}/video-posters/${photo.id}.jpg` : null,
            status: "pending"
          }))
        });
      }
    }, { timeout: 15000 });

    const currentObjectKeys = new Set(photosForProcessing.flatMap(photoObjectKeys));
    const previousReplacementObjectKeys = Array.from(
      new Set(replacedPhotos.flatMap((photo) => photo.previousObjectKeys).filter((key) => !currentObjectKeys.has(key)))
    );

    await Promise.all(previousReplacementObjectKeys.map((key) => deletePhotoObject(key)));

    if (photosForProcessing.length > 0) {
      scheduleGalleryMediaProcessing(galleryId);
    }
  }

  if (
    sortedUploads.length > 0 &&
    session.deliveryStage === PHOTO_DELIVERY_STAGE_FINAL &&
    isProofingGallery(session.gallery.galleryMode) &&
    session.gallery.proofingStatus === PROOFING_STATUS_SUBMITTED
  ) {
    await prisma.gallery.update({
      where: { id: galleryId },
      data: {
        proofingStatus: PROOFING_STATUS_PROCESSING,
        proofingStatusUpdatedAt: new Date()
      }
    });
  }

  const uploadSession = await incrementCompletedUploadSessionCounts(session.id, sortedUploads.length);
  const isSessionFinished =
    Boolean(uploadSession) &&
    uploadSession!.totalCount > 0 &&
    uploadSession!.completedCount + uploadSession!.failedCount >= uploadSession!.totalCount;

  if (isSessionFinished) {
    await reorderGalleryPhotosByCaptureTime(galleryId);

    if (session.deliveryStage === PHOTO_DELIVERY_STAGE_FINAL) {
      await invalidatePublicGalleryDownloadPackages(galleryId);
    }

    if (session.deliveryStage === PHOTO_DELIVERY_STAGE_RAW && isProofingGallery(session.gallery.galleryMode)) {
      const inviteResult = await sendProofingInviteForGallery(galleryId);

      if (!inviteResult.ok && inviteResult.reason !== "missing-email") {
        console.error("Proofing invite email failed", {
          galleryId,
          reason: inviteResult.reason
        });
      }
    }
  }

  if (options.revalidate !== false || isSessionFinished) {
    revalidatePath(`/admin/galleries/${galleryId}`);
    revalidatePath(`/g/${session.gallery.slug}`);
  }

  return {
    ok: true,
    completedItemIds: sortedUploads.map((upload) => upload.uploadItemId).filter((id): id is string => Boolean(id)),
    redirectTo: `/admin/galleries/${galleryId}?photoAdded=1`
  };
}

export async function deletePhotoAction(photoId: string, galleryId: string) {
  await requireGalleryAccess(galleryId);

  const gallery = await prisma.gallery.findFirst({
    where: { id: galleryId },
    select: { coverPhotoId: true, slug: true }
  });
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { r2Key: true, thumbnailUrl: true, previewUrl: true }
  });

  await prisma.photo.delete({
    where: { id: photoId }
  });

  if (gallery?.coverPhotoId === photoId) {
    const nextCover = await prisma.photo.findFirst({
      where: { galleryId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true }
    });

    await prisma.gallery.update({
      where: { id: galleryId },
      data: { coverPhotoId: nextCover?.id ?? null }
    });
  }

  await Promise.all([
    deletePhotoObject(photo?.r2Key ?? ""),
    deletePhotoObject(getR2KeyFromPublicUrl(photo?.thumbnailUrl) ?? ""),
    deletePhotoObject(getR2KeyFromPublicUrl(photo?.previewUrl) ?? "")
  ]);
  await invalidatePublicGalleryDownloadPackages(galleryId);

  revalidatePath(`/admin/galleries/${galleryId}`);

  if (gallery) {
    revalidatePath(`/g/${gallery.slug}`);
  }
}

export async function cleanupDuplicatePhotosAction(galleryId: string) {
  const { gallery } = await requireGalleryAccess(galleryId);

  const [currentGallery, photos] = await Promise.all([
    prisma.gallery.findUnique({
      where: { id: galleryId },
      select: { coverPhotoId: true }
    }),
    prisma.photo.findMany({
      where: { galleryId },
      orderBy: [
        { deliveryStage: "asc" },
        { mediaType: "asc" },
        { filename: "asc" },
        { fileSize: "asc" },
        { createdAt: "asc" },
        { sortOrder: "asc" }
      ],
      select: {
        id: true,
        filename: true,
        mediaType: true,
        deliveryStage: true,
        fileSize: true,
        r2Key: true,
        imageUrl: true,
        thumbnailUrl: true,
        previewUrl: true
      }
    })
  ]);
  const groups = new Map<string, typeof photos>();

  for (const photo of photos) {
    const key = `${photo.deliveryStage}\u001F${photoDuplicateKey(photo)}`;
    const group = groups.get(key) ?? [];
    group.push(photo);
    groups.set(key, group);
  }

  const replacementPhotoIdByDuplicateId = new Map<string, string>();
  const duplicatePhotos = [...groups.values()].flatMap((group) => {
    const [photoToKeep, ...duplicates] = group;

    for (const duplicate of duplicates) {
      replacementPhotoIdByDuplicateId.set(duplicate.id, photoToKeep.id);
    }

    return duplicates;
  });

  if (duplicatePhotos.length === 0) {
    redirect(`/admin/galleries/${galleryId}?tab=photos&duplicateCleanup=none`);
  }

  const duplicatePhotoIds = duplicatePhotos.map((photo) => photo.id);
  const duplicatePhotoIdSet = new Set(duplicatePhotoIds);
  const retainedObjectKeys = new Set(photos.filter((photo) => !duplicatePhotoIdSet.has(photo.id)).flatMap(photoObjectKeys));
  const duplicateObjectKeys = Array.from(
    new Set(duplicatePhotos.flatMap(photoObjectKeys).filter((key) => !retainedObjectKeys.has(key)))
  );

  await prisma.$transaction(async (tx) => {
    const favoriteItems = await tx.galleryFavoriteItem.findMany({
      where: { photoId: { in: duplicatePhotoIds } },
      select: { listId: true, photoId: true }
    });

    for (const item of favoriteItems) {
      const replacementPhotoId = replacementPhotoIdByDuplicateId.get(item.photoId);

      if (!replacementPhotoId) {
        continue;
      }

      await tx.galleryFavoriteItem.upsert({
        where: {
          listId_photoId: {
            listId: item.listId,
            photoId: replacementPhotoId
          }
        },
        update: {},
        create: {
          listId: item.listId,
          photoId: replacementPhotoId
        }
      });
    }

    await tx.galleryFavoriteItem.deleteMany({
      where: { photoId: { in: duplicatePhotoIds } }
    });
    await tx.mediaProcessingJob.deleteMany({
      where: { photoId: { in: duplicatePhotoIds } }
    });

    const coverReplacementId = currentGallery?.coverPhotoId
      ? replacementPhotoIdByDuplicateId.get(currentGallery.coverPhotoId)
      : null;

    if (coverReplacementId) {
      await tx.gallery.update({
        where: { id: galleryId },
        data: { coverPhotoId: coverReplacementId }
      });
    }

    await tx.photo.deleteMany({
      where: { id: { in: duplicatePhotoIds } }
    });
  }, { timeout: 30000 });

  await Promise.all(duplicateObjectKeys.map((key) => deletePhotoObject(key)));
  await reorderGalleryPhotosByCaptureTime(galleryId);
  await invalidatePublicGalleryDownloadPackages(galleryId);

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${gallery.slug}`);
  revalidatePath(`/client/${gallery.slug}`);
  redirect(`/admin/galleries/${galleryId}?tab=photos&duplicateCleanup=${duplicatePhotos.length}`);
}

export async function requeueGalleryMediaProcessingAction(galleryId: string) {
  const { gallery } = await requireGalleryAccess(galleryId);
  const photos = await prisma.photo.findMany({
    where: {
      galleryId,
      mediaType: { not: "video" },
      r2Key: { not: "" }
    },
    select: {
      id: true,
      filename: true,
      r2Key: true,
      imageUrl: true,
      thumbnailUrl: true,
      previewUrl: true,
      mediaType: true,
      processingStatus: true,
      processingRequestedAt: true
    }
  });
  const targetPhotos = photos.filter(isRequeueableMediaPhoto);

  if (targetPhotos.length === 0) {
    revalidatePath(`/admin/galleries/${galleryId}`);
    redirect(`/admin/galleries/${galleryId}?tab=photos&mediaProcessing=none`);
  }

  const targetPhotoIds = targetPhotos.map((photo) => photo.id);
  const existingJobs = await prisma.mediaProcessingJob.findMany({
    where: {
      galleryId,
      photoId: { in: targetPhotoIds }
    },
    select: {
      photoId: true,
      status: true
    }
  });
  const reusableJobPhotoIds = new Set(
    existingJobs.filter((job) => job.status !== "completed").map((job) => job.photoId)
  );
  const now = new Date();
  const newJobPhotos = targetPhotos.filter((photo) => !reusableJobPhotoIds.has(photo.id));

  await prisma.$transaction(async (tx) => {
    await tx.photo.updateMany({
      where: { id: { in: targetPhotoIds } },
      data: {
        processingStatus: "pending",
        processingError: null,
        processingRequestedAt: now,
        processingCompletedAt: null
      }
    });

    await tx.mediaProcessingJob.updateMany({
      where: {
        galleryId,
        photoId: { in: targetPhotoIds },
        status: { in: ["pending", "processing", "failed"] }
      },
      data: {
        status: "pending",
        attempts: 0,
        errorMessage: null,
        claimedAt: null,
        completedAt: null
      }
    });

    if (newJobPhotos.length > 0) {
      await tx.mediaProcessingJob.createMany({
        data: newJobPhotos.map((photo) => ({
          galleryId,
          photoId: photo.id,
          mediaType: "image",
          sourceR2Key: photo.r2Key,
          thumbnailR2Key: createPhotoVariantObjectKey({
            gallerySlug: gallery.slug,
            originalFilename: photo.filename,
            variant: "thumbnail"
          }),
          previewR2Key: createPhotoVariantObjectKey({
            gallerySlug: gallery.slug,
            originalFilename: photo.filename,
            variant: "preview"
          }),
          status: "pending"
        }))
      });
    }
  }, { timeout: 15000 });

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${gallery.slug}`);
  scheduleGalleryMediaProcessing(galleryId, { force: true });
  redirect(`/admin/galleries/${galleryId}?tab=photos&mediaProcessing=queued`);
}

export async function queueGalleryZipPackageAction(galleryId: string) {
  const { gallery } = await requireGalleryAccess(galleryId);
  const now = Date.now();

  const galleryWithPhotos = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: {
      slug: true,
      isActive: true,
      downloadsEnabled: true,
      galleryMode: true,
      proofingStatus: true,
      photos: {
        where: { isClientHidden: false, deliveryStage: PHOTO_DELIVERY_STAGE_FINAL },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          createdAt: true,
          fileSize: true
        }
      }
    }
  });

  if (!galleryWithPhotos || !galleryWithPhotos.isActive) {
    redirect(`/admin/galleries/${gallery.id}?tab=downloads&zip=not-active`);
  }

  if (!galleryWithPhotos.downloadsEnabled) {
    redirect(`/admin/galleries/${gallery.id}?tab=downloads&zip=downloads-disabled`);
  }

  if (
    isProofingGallery(galleryWithPhotos.galleryMode) &&
    galleryWithPhotos.proofingStatus !== PROOFING_STATUS_DELIVERED
  ) {
    redirect(`/admin/galleries/${gallery.id}?tab=downloads&zip=proofing-pending`);
  }

  const photoCount = galleryWithPhotos.photos.length;

  if (photoCount === 0) {
    redirect(`/admin/galleries/${gallery.id}?tab=downloads&zip=no-photos`);
  }

  const latestPhotoCreatedAt = galleryWithPhotos.photos.reduce<Date | null>((latest, photo) => {
    if (!latest || photo.createdAt > latest) {
      return photo.createdAt;
    }

    return latest;
  }, null);

  const freshCompletedPackages = await prisma.galleryDownloadPackage.findMany({
    where: {
      galleryId,
      scope: PUBLIC_DOWNLOAD_SCOPE,
      status: "completed",
      photoCount,
      downloadUrl: { not: null },
      r2Key: { not: null },
      generatedAt: latestPhotoCreatedAt ? { gte: latestPhotoCreatedAt } : undefined
    },
    orderBy: [{ groupId: "desc" }, { partIndex: "asc" }, { generatedAt: "desc" }],
    select: {
      id: true,
      groupId: true,
      status: true,
      downloadUrl: true,
      partIndex: true,
      partCount: true
    }
  });
  const completedGroups = new Map<string, typeof freshCompletedPackages>();

  for (const downloadPackage of freshCompletedPackages) {
    const key = downloadPackage.groupId ?? downloadPackage.id;
    completedGroups.set(key, [...(completedGroups.get(key) ?? []), downloadPackage]);
  }

  const hasFreshCompletedGroup = Array.from(completedGroups.values()).some((packages) => {
    const expectedPartCount = Math.max(...packages.map((downloadPackage) => downloadPackage.partCount), packages.length, 1);
    const completedPartIndexes = new Set(
      packages
        .filter((downloadPackage) => downloadPackage.status === "completed" && downloadPackage.downloadUrl)
        .map((downloadPackage) => downloadPackage.partIndex)
    );

    return packages.length === expectedPartCount && Array.from({ length: expectedPartCount }, (_, index) => completedPartIndexes.has(index)).every(Boolean);
  });

  if (hasFreshCompletedGroup) {
    revalidatePath(`/admin/galleries/${gallery.id}`);
    redirect(`/admin/galleries/${gallery.id}?tab=downloads&zip=already-ready`);
  }

  const existingPackages = await prisma.galleryDownloadPackage.findMany({
    where: {
      galleryId,
      scope: PUBLIC_DOWNLOAD_SCOPE,
      status: { in: ["pending", "processing"] },
      photoCount
    },
    orderBy: [{ groupId: "desc" }, { partIndex: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      updatedAt: true,
      groupId: true
    }
  });

  if (existingPackages.length > 0) {
    const latestGroupKey = existingPackages[0].groupId ?? existingPackages[0].id;
    const latestGroupPackages = existingPackages.filter((downloadPackage) => (downloadPackage.groupId ?? downloadPackage.id) === latestGroupKey);
    const packagesToKick = latestGroupPackages.filter(
      (downloadPackage) =>
        downloadPackage.status === "pending" ||
        (downloadPackage.status === "processing" && now - downloadPackage.updatedAt.getTime() > STALE_ZIP_PROCESSING_MS)
    );

    if (packagesToKick.length > 0) {
      const payloads = await Promise.all(
        packagesToKick.map(async (downloadPackage) => ({
          galleryId,
          packageId: downloadPackage.id,
          jobId: (await enqueueGalleryZipJob({ galleryId, packageId: downloadPackage.id })).id
        }))
      );
      after(async () => {
        await kickGalleryZipJobs(payloads);
      });

      revalidatePath(`/admin/galleries/${gallery.id}`);
      redirect(`/admin/galleries/${gallery.id}?tab=downloads&zip=queued`);
    }

    revalidatePath(`/admin/galleries/${gallery.id}`);
    redirect(`/admin/galleries/${gallery.id}?tab=downloads&zip=already-running`);
  }

  const ranges = createZipPartRanges(galleryWithPhotos.photos);
  const partCount = ranges.length;
  const groupId = partCount > 1 ? randomUUID() : null;
  const downloadPackages = await prisma.$transaction(
    ranges.map((range, partIndex) =>
      prisma.galleryDownloadPackage.create({
        data: {
          galleryId,
          scope: PUBLIC_DOWNLOAD_SCOPE,
          status: "pending",
          photoCount,
          partIndex,
          partCount,
          photoOffset: range.offset,
          photoLimit: range.limit,
          groupId
        }
      })
    )
  );
  const payloads = await Promise.all(
    downloadPackages.map(async (downloadPackage) => ({
      galleryId,
      packageId: downloadPackage.id,
      jobId: (await enqueueGalleryZipJob({
        galleryId,
        packageId: downloadPackage.id
      })).id
    }))
  );

  after(async () => {
    await kickGalleryZipJobs(payloads);
  });

  revalidatePath(`/admin/galleries/${gallery.id}`);
  revalidatePath(`/g/${galleryWithPhotos.slug}`);
  redirect(`/admin/galleries/${gallery.id}?tab=downloads&zip=queued`);
}

function isZipFilename(filename: string) {
  return filename.trim().toLowerCase().endsWith(".zip");
}

function normalizeZipContentType(contentType: string | null | undefined) {
  const value = (contentType ?? "").trim();
  return value || "application/zip";
}

async function getManualZipGalleryState(galleryId: string) {
  const galleryWithPhotos = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: {
      id: true,
      slug: true,
      isActive: true,
      downloadsEnabled: true,
      galleryMode: true,
      proofingStatus: true,
      photos: {
        where: { isClientHidden: false, deliveryStage: PHOTO_DELIVERY_STAGE_FINAL },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true
        }
      }
    }
  });

  if (!galleryWithPhotos || !galleryWithPhotos.isActive) {
    return { ok: false as const, reason: "not-active" };
  }

  if (!galleryWithPhotos.downloadsEnabled) {
    return { ok: false as const, reason: "downloads-disabled" };
  }

  if (
    isProofingGallery(galleryWithPhotos.galleryMode) &&
    galleryWithPhotos.proofingStatus !== PROOFING_STATUS_DELIVERED
  ) {
    return { ok: false as const, reason: "proofing-pending" };
  }

  if (galleryWithPhotos.photos.length === 0) {
    return { ok: false as const, reason: "no-photos" };
  }

  return {
    ok: true as const,
    gallery: galleryWithPhotos,
    photoCount: galleryWithPhotos.photos.length
  };
}

export async function createManualGalleryZipUploadTargetAction(
  galleryId: string,
  file: {
    filename: string;
    contentType?: string | null;
    fileSize: number;
  }
) {
  const { gallery } = await requireGalleryAccess(galleryId);
  const filename = (file.filename ?? "").trim();

  if (!filename || !isZipFilename(filename)) {
    return {
      ok: false,
      message: "Csak .zip fájlt tudsz feltölteni."
    };
  }

  if (!Number.isFinite(file.fileSize) || file.fileSize <= 0) {
    return {
      ok: false,
      message: "A ZIP fájl üres vagy nem olvasható."
    };
  }

  const state = await getManualZipGalleryState(galleryId);

  if (!state.ok) {
    return {
      ok: false,
      message: "Ehhez a galériához most nem tölthető fel ZIP csomag."
    };
  }

  const r2Key = createManualGalleryZipObjectKey({
    gallerySlug: state.gallery.slug,
    originalFilename: filename
  });
  const downloadUrl = getPhotoPublicUrl(r2Key);

  try {
    return {
      ok: true,
      r2Key,
      downloadUrl,
      photoCount: state.photoCount,
      uploadUrl: await createPresignedPhotoUploadUrl({
        r2Key,
        contentType: normalizeZipContentType(file.contentType)
      })
    };
  } catch (error) {
    console.error("Manual ZIP upload target creation failed", {
      galleryId: gallery.id,
      error
    });

    return {
      ok: false,
      message: "Nem sikerült előkészíteni a ZIP feltöltést."
    };
  }
}

export async function completeManualGalleryZipUploadAction(
  galleryId: string,
  upload: {
    r2Key: string;
    downloadUrl: string;
    fileSize: number;
  }
) {
  const { gallery } = await requireGalleryAccess(galleryId);
  const state = await getManualZipGalleryState(galleryId);

  if (!state.ok) {
    return {
      ok: false,
      message: "Ehhez a galériához most nem menthető ZIP csomag."
    };
  }

  const manualPrefix = `galleries/${state.gallery.slug}/downloads/manual/`;

  if (!upload.r2Key?.startsWith(manualPrefix) || !upload.downloadUrl) {
    return {
      ok: false,
      message: "Érvénytelen ZIP feltöltési cél."
    };
  }

  if (!Number.isFinite(upload.fileSize) || upload.fileSize <= 0) {
    return {
      ok: false,
      message: "A ZIP fájl mérete érvénytelen."
    };
  }

  const generatedAt = new Date();
  const fileSize = BigInt(Math.round(upload.fileSize));
  const downloadPackage = await prisma.galleryDownloadPackage.create({
    data: {
      galleryId,
      scope: PUBLIC_DOWNLOAD_SCOPE,
      status: "completed",
      photoCount: state.photoCount,
      processedCount: state.photoCount,
      processedBytes: fileSize,
      fileSize,
      partIndex: 0,
      partCount: 1,
      photoOffset: 0,
      photoLimit: state.photoCount,
      r2Key: upload.r2Key,
      downloadUrl: upload.downloadUrl,
      generatedAt
    },
    select: {
      id: true
    }
  });

  await prisma.galleryDownloadPackage.updateMany({
    where: {
      galleryId,
      scope: PUBLIC_DOWNLOAD_SCOPE,
      id: { not: downloadPackage.id },
      status: { in: ["pending", "processing", "failed"] }
    },
    data: {
      status: "stale",
      errorMessage: "Manuálisan feltöltött ZIP csomag váltotta le."
    }
  });

  await sendGalleryDownloadLinksForPackage(downloadPackage.id);

  revalidatePath(`/admin/galleries/${gallery.id}`);
  revalidatePath(`/g/${state.gallery.slug}`);

  return {
    ok: true,
    packageId: downloadPackage.id
  };
}

export async function setCoverPhotoAction(galleryId: string, photoId: string) {
  await requireGalleryAccess(galleryId);

  const photo = await prisma.photo.findFirst({
    where: { id: photoId, galleryId },
    select: { gallery: { select: { slug: true } } }
  });

  if (!photo) {
    redirect(`/admin/galleries/${galleryId}?photoError=missing`);
  }

  await prisma.gallery.update({
    where: { id: galleryId },
    data: { coverPhotoId: photoId }
  });

  revalidatePath("/admin/galleries");
  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${photo.gallery.slug}`);
  redirect(`/admin/galleries/${galleryId}?coverSet=1`);
}

export async function movePhotoAction(galleryId: string, photoId: string, direction: "up" | "down") {
  const { gallery } = await requireGalleryAccess(galleryId);

  const photos = await prisma.photo.findMany({
    where: { galleryId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true }
  });
  const currentIndex = photos.findIndex((photo) => photo.id === photoId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= photos.length) {
    redirect(`/admin/galleries/${galleryId}`);
  }

  const reordered = [...photos];
  const [current] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, current);

  await prisma.$transaction(
    reordered.map((photo, index) =>
      prisma.photo.update({
        where: { id: photo.id },
        data: { sortOrder: index + 1 }
      })
    )
  );
  await invalidatePublicGalleryDownloadPackages(galleryId);

  revalidatePath(`/admin/galleries/${galleryId}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/galleries/${galleryId}?ordered=1`);
}
