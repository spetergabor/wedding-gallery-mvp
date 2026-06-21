"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { invalidatePublicGalleryDownloadPackages } from "@/lib/download-packages";
import { normalizeSlug } from "@/lib/slug";
import { hasAnyAdmin, requireAdmin, signInAdmin, signOutAdmin } from "@/lib/auth";
import { notificationWhere } from "@/lib/admin-scope";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  GALLERY_MODE_FULL,
  GALLERY_MODE_PROOFING,
  PHOTO_DELIVERY_STAGE_FINAL,
  PHOTO_DELIVERY_STAGE_RAW,
  PROOFING_STATUSES,
  PROOFING_STATUS_NOT_OPENED,
  PROOFING_STATUS_PROCESSING,
  PROOFING_STATUS_SUBMITTED,
  type ProofingStatus,
  defaultPhotoDeliveryStageForGalleryMode,
  isProofingGallery,
  normalizePhotoDeliveryStage
} from "@/lib/proofing";
import { publicGalleryUrl, sendClientProofingInviteEmail } from "@/lib/email";
import {
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
};

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
  const result = await signInAdmin(email, password, twoFactorCode);

  if (result === "pending") {
    redirect("/admin/login?approval=pending");
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

  await prisma.gallery.update({
    where: { id: galleryId },
    data: {
      galleryMode: GALLERY_MODE_PROOFING,
      proofingStatus: status,
      proofingStatusUpdatedAt: new Date()
    }
  });

  revalidatePath(`/admin/galleries/${galleryId}`);
  redirect(`/admin/galleries/${galleryId}?tab=client&proofingStatus=1`);
}

export async function createGalleryAction(formData: FormData) {
  const admin = await requireAdmin();

  const title = formString(formData, "title");
  const rawSlug = formString(formData, "slug");
  const password = formString(formData, "password");
  const eventDate = formDate(formData, "eventDate");
  const slug = normalizeSlug(rawSlug || title);
  const isActive = formData.get("isActive") === "on";
  const galleryMode = galleryModeFromForm(formData);
  const downloadsEnabled = formData.get("downloadsEnabled") === "on";
  const clientEmail = normalizeEmail(formString(formData, "clientEmail"));

  if (!title || !slug) {
    redirect("/admin/galleries/new?error=missing");
  }

  if (clientEmail && !isValidEmail(clientEmail)) {
    redirect("/admin/galleries/new?error=email");
  }

  let gallery;

  try {
    gallery = await prisma.gallery.create({
      data: {
        title,
        slug,
        adminId: admin.id,
        password: password || null,
        eventDate,
        isActive,
        galleryMode,
        proofingStatus: PROOFING_STATUS_NOT_OPENED,
        proofingStatusUpdatedAt: isProofingGallery(galleryMode) ? new Date() : null,
        downloadsEnabled,
        clientEmail: clientEmail || null,
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
  redirect(`/admin/galleries/${gallery.id}`);
}

export async function updateGalleryAction(id: string, formData: FormData) {
  await requireGalleryAccess(id);

  const title = formString(formData, "title");
  const rawSlug = formString(formData, "slug");
  const password = formString(formData, "password");
  const eventDate = formDate(formData, "eventDate");
  const slug = normalizeSlug(rawSlug || title);
  const isActive = formData.get("isActive") === "on";
  const galleryMode = galleryModeFromForm(formData);
  const downloadsEnabled = formData.get("downloadsEnabled") === "on";
  const clientEmail = normalizeEmail(formString(formData, "clientEmail"));

  if (!title || !slug) {
    redirect(`/admin/galleries/${id}?error=missing`);
  }

  if (clientEmail && !isValidEmail(clientEmail)) {
    redirect(`/admin/galleries/${id}?error=email`);
  }

  let previousSlug = slug;

  try {
    const previousGallery = await prisma.gallery.findFirst({
      where: { id },
      select: { slug: true, galleryMode: true }
    });

    previousSlug = previousGallery?.slug ?? slug;
    const becameProofing = !isProofingGallery(previousGallery?.galleryMode) && isProofingGallery(galleryMode);

    await prisma.gallery.update({
      where: { id },
      data: {
        title,
        slug,
        password: password || null,
        eventDate,
        isActive,
        galleryMode,
        clientEmail: clientEmail || null,
        proofingInviteEmailError: null,
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

export async function createPhotoUploadTargetsAction(galleryId: string, sessionId: string, files: PhotoUploadRequest[]) {
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
    const uploads = await Promise.all(
      validFiles.map(async (file) => {
        const mediaType = file.mediaType === "video" || file.contentType?.startsWith("video/") ? "video" : "image";
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
        const uploadItem = await prisma.galleryUploadItem.upsert({
          where: {
            sessionId_clientId: {
              sessionId: session.id,
              clientId: file.clientId
            }
          },
          create: {
            sessionId: session.id,
            clientId: file.clientId,
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
          },
          update: {
            filename: file.filename,
            deliveryStage: session.deliveryStage,
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
          },
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
    const createdPhotos = sortedUploads.map((upload) => {
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

    await prisma.$transaction(async (tx) => {
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

      if (createdPhotos.length > 0) {
        await tx.mediaProcessingJob.createMany({
          data: createdPhotos.map((photo) => ({
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
