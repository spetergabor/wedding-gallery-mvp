"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { adminOwnedWhere, galleryAccessWhere, ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { GALLERY_DELIVERY_VIEW_ONLY } from "@/lib/gallery-delivery";
import { invalidateGuestGalleryDownloadPackages } from "@/lib/download-packages";
import { kickGalleryZipJobs, prepareGuestGalleryZipPackages } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_GUEST } from "@/lib/proofing";
import { normalizeSlug } from "@/lib/slug";
import { deletePhotoObject, getR2KeyFromPublicUrl } from "@/lib/storage";
import { workDateTimeInAppTimeZone } from "@/lib/work-date";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formDate(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    return null;
  }

  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formEndDate(formData: FormData, key: string) {
  const value = formString(formData, key);

  if (!value) {
    return null;
  }

  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : workDateTimeInAppTimeZone(date, null, "end");
}

function createGuestGallerySlug(title: string) {
  const base = normalizeSlug(title) || "vendeggaleria";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

function normalizeModerationMode(value: string) {
  return value === "approval" ? "approval" : "automatic";
}

function normalizeGuestUploadLimit(value: string, fallback = 1000) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(5000, Math.max(20, parsed)) : fallback;
}

async function requireGuestGallery(galleryId: string) {
  const admin = await requireAdmin();
  const gallery = await prisma.gallery.findFirst({
    where: {
      ...galleryAccessWhere(admin, galleryId),
      galleryMode: GALLERY_MODE_GUEST
    },
    select: {
      id: true,
      slug: true,
      customerId: true,
      guestGalleryExpiresAt: true,
      guestGalleryArchivedAt: true
    }
  });

  if (!gallery) {
    redirect("/admin/guest-galleries?error=missing");
  }

  return { admin, gallery };
}

export async function createGuestGalleryAction(formData: FormData) {
  const admin = await requireAdmin();
  const title = formString(formData, "title");
  const customerId = formString(formData, "customerId");
  const password = formString(formData, "password");
  const submittedEventDate = formDate(formData, "eventDate");
  const guestGalleryExpiresAt = formEndDate(formData, "guestGalleryExpiresAt");

  if (!title) {
    redirect("/admin/guest-galleries/new?error=missing");
  }

  const customer = customerId
    ? await prisma.customer.findFirst({
        where: {
          id: customerId,
          ...adminOwnedWhere(admin)
        },
        select: {
          id: true,
          primaryEmail: true,
          weddingDate: true
        }
      })
    : null;

  if (customerId && !customer) {
    redirect("/admin/guest-galleries/new?error=customer");
  }

  let gallery;

  try {
    gallery = await prisma.gallery.create({
      data: {
        adminId: ownerAdminId(admin),
        customerId: customer?.id ?? null,
        title,
        slug: createGuestGallerySlug(title),
        password: password || null,
        eventDate: submittedEventDate ?? customer?.weddingDate ?? null,
        isActive: true,
        galleryMode: GALLERY_MODE_GUEST,
        deliveryMode: GALLERY_DELIVERY_VIEW_ONLY,
        downloadsEnabled: false,
        guestUploadsEnabled: true,
        guestUploadModerationMode: "automatic",
        guestUploadLimit: 1000,
        guestGalleryExpiresAt,
        showContactBox: false,
        publicColumnCount: 2,
        clientEmail: customer?.primaryEmail.toLowerCase() ?? null,
        clientAccessToken: randomBytes(24).toString("base64url")
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/admin/guest-galleries/new?error=slug");
    }

    throw error;
  }

  revalidatePath("/admin/guest-galleries");
  redirect(`/admin/guest-galleries/${gallery.id}?created=1`);
}

export async function updateGuestGalleryAction(galleryId: string, formData: FormData) {
  const { gallery } = await requireGuestGallery(galleryId);
  const title = formString(formData, "title");
  const password = formString(formData, "password");
  const eventDate = formDate(formData, "eventDate");
  const isActive = formData.get("isActive") === "on";
  const guestUploadsEnabled = formData.get("guestUploadsEnabled") === "on";
  const guestUploadModerationMode = normalizeModerationMode(formString(formData, "guestUploadModerationMode"));
  const guestUploadLimit = normalizeGuestUploadLimit(formString(formData, "guestUploadLimit"));
  const guestGalleryExpiresAt = formEndDate(formData, "guestGalleryExpiresAt");

  if (!title) {
    redirect(`/admin/guest-galleries/${gallery.id}?error=missing`);
  }

  await prisma.gallery.update({
    where: { id: gallery.id },
    data: {
      title,
      password: password || null,
      eventDate,
      isActive,
      guestUploadsEnabled,
      guestUploadModerationMode,
      guestUploadLimit,
      guestGalleryExpiresAt
    }
  });

  revalidatePath("/admin/guest-galleries");
  revalidatePath(`/admin/guest-galleries/${gallery.id}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/guest-galleries/${gallery.id}?saved=1`);
}

export async function toggleGuestGalleryActiveAction(galleryId: string, nextIsActive: boolean) {
  const { gallery } = await requireGuestGallery(galleryId);
  const restoringArchive = nextIsActive && (
    Boolean(gallery.guestGalleryArchivedAt) ||
    Boolean(gallery.guestGalleryExpiresAt && gallery.guestGalleryExpiresAt <= new Date())
  );

  await prisma.gallery.update({
    where: { id: gallery.id },
    data: {
      isActive: nextIsActive,
      ...(restoringArchive
        ? {
            guestGalleryArchivedAt: null,
            guestGalleryExpiresAt: null,
            guestUploadsEnabled: true
          }
        : {})
    }
  });

  revalidatePath("/admin/guest-galleries");
  revalidatePath(`/admin/guest-galleries/${gallery.id}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect("/admin/guest-galleries?updated=1");
}

export async function setGuestPhotoVisibilityAction(
  galleryId: string,
  uploadId: string,
  visible: boolean
) {
  const { gallery } = await requireGuestGallery(galleryId);
  const upload = await prisma.galleryGuestUpload.findFirst({
    where: {
      id: uploadId,
      galleryId: gallery.id
    },
    select: { id: true }
  });

  if (!upload) {
    redirect(`/admin/guest-galleries/${gallery.id}?error=photo`);
  }

  await prisma.$transaction([
    prisma.galleryGuestUpload.update({
      where: { id: upload.id },
      data: {
        status: visible ? "visible" : "hidden",
        visibleAt: visible ? new Date() : null
      }
    }),
    prisma.gallery.update({
      where: { id: gallery.id },
      data: { guestGalleryRevision: { increment: 1 } }
    })
  ]);

  revalidatePath(`/admin/guest-galleries/${gallery.id}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/guest-galleries/${gallery.id}?photo=${visible ? "shown" : "hidden"}`);
}

export async function bulkUpdateGuestPhotosAction(
  galleryId: string,
  uploadIds: string[],
  operation: "approve" | "hide" | "delete"
): Promise<{ ok: boolean; message: string; changedCount: number }> {
  const { gallery } = await requireGuestGallery(galleryId);
  const ids = [...new Set(uploadIds.filter((id): id is string => typeof id === "string" && Boolean(id)))].slice(0, 5000);

  if (!["approve", "hide", "delete"].includes(operation)) {
    return { ok: false, message: "Érvénytelen tömeges művelet.", changedCount: 0 };
  }

  if (ids.length === 0) {
    return { ok: false, message: "Nincs kijelölt vendégfotó.", changedCount: 0 };
  }

  const uploads = await prisma.galleryGuestUpload.findMany({
    where: {
      galleryId: gallery.id,
      id: { in: ids }
    },
    select: {
      id: true,
      r2Key: true,
      imageUrl: true,
      thumbnailUrl: true,
      previewUrl: true
    }
  });

  if (uploads.length === 0) {
    return { ok: false, message: "A kijelölt vendégfotók nem találhatók.", changedCount: 0 };
  }

  if (operation === "delete") {
    await prisma.$transaction([
      prisma.galleryGuestUpload.deleteMany({
        where: { galleryId: gallery.id, id: { in: uploads.map((upload) => upload.id) } }
      }),
      prisma.gallery.update({
        where: { id: gallery.id },
        data: { guestGalleryRevision: { increment: 1 } }
      })
    ]);
    await invalidateGuestGalleryDownloadPackages(gallery.id);

    const objectKeys = new Set(
      uploads.flatMap((upload) => [
        upload.r2Key,
        getR2KeyFromPublicUrl(upload.imageUrl),
        getR2KeyFromPublicUrl(upload.thumbnailUrl),
        getR2KeyFromPublicUrl(upload.previewUrl)
      ]).filter((key): key is string => Boolean(key))
    );

    const keys = [...objectKeys];

    for (let offset = 0; offset < keys.length; offset += 25) {
      await Promise.allSettled(keys.slice(offset, offset + 25).map((key) => deletePhotoObject(key)));
    }
  } else {
    await prisma.$transaction([
      prisma.galleryGuestUpload.updateMany({
        where: { galleryId: gallery.id, id: { in: uploads.map((upload) => upload.id) } },
        data: {
          status: operation === "approve" ? "visible" : "hidden",
          visibleAt: operation === "approve" ? new Date() : null
        }
      }),
      prisma.gallery.update({
        where: { id: gallery.id },
        data: { guestGalleryRevision: { increment: 1 } }
      })
    ]);
  }

  revalidatePath(`/admin/guest-galleries/${gallery.id}`);
  revalidatePath(`/g/${gallery.slug}`);

  const message = operation === "delete"
    ? `${uploads.length} kép véglegesen törölve.`
    : operation === "approve"
      ? `${uploads.length} kép jóváhagyva.`
      : `${uploads.length} kép elrejtve.`;

  return { ok: true, message, changedCount: uploads.length };
}

export async function queueGuestGalleryZipAction(galleryId: string) {
  const { gallery } = await requireGuestGallery(galleryId);
  const result = await prepareGuestGalleryZipPackages(gallery.id);
  const zipStatus = result.ok
    ? result.cached
      ? "already-ready"
      : result.payloads.length > 0
        ? "queued"
        : "already-running"
    : result.reason;

  if (result.ok && result.payloads.length > 0) {
    after(async () => {
      await kickGalleryZipJobs(result.payloads);
    });
  }

  revalidatePath(`/admin/guest-galleries/${gallery.id}`);
  redirect(`/admin/guest-galleries/${gallery.id}?zip=${zipStatus}`);
}

export async function archiveGuestGalleryAction(galleryId: string) {
  const { gallery } = await requireGuestGallery(galleryId);

  await prisma.gallery.update({
    where: { id: gallery.id },
    data: {
      isActive: false,
      guestUploadsEnabled: false,
      guestGalleryArchivedAt: new Date()
    }
  });

  revalidatePath("/admin/guest-galleries");
  revalidatePath(`/admin/guest-galleries/${gallery.id}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/guest-galleries/${gallery.id}?archive=done`);
}

export async function restoreGuestGalleryAction(galleryId: string) {
  const { gallery } = await requireGuestGallery(galleryId);

  await prisma.gallery.update({
    where: { id: gallery.id },
    data: {
      isActive: true,
      guestUploadsEnabled: true,
      guestGalleryArchivedAt: null,
      guestGalleryExpiresAt: null
    }
  });

  revalidatePath("/admin/guest-galleries");
  revalidatePath(`/admin/guest-galleries/${gallery.id}`);
  revalidatePath(`/g/${gallery.slug}`);
  redirect(`/admin/guest-galleries/${gallery.id}?archive=restored`);
}
