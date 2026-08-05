"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { adminOwnedWhere, galleryAccessWhere, ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { GALLERY_DELIVERY_VIEW_ONLY } from "@/lib/gallery-delivery";
import {
  ADMIN_GUEST_PHOTO_PAGE_SIZE,
  buildGuestGalleryAdminPhotoWhere,
  normalizeGuestGalleryAdminCursor,
  normalizeGuestGalleryAdminFilters,
  serializeGuestGalleryAdminPhoto,
  type GuestGalleryAdminPhotoCursor,
  type GuestGalleryAdminPhotoFilters,
  type GuestGalleryAdminSelection
} from "@/lib/guest-gallery-admin";
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
      guestGalleryArchivedAt: true,
      guestGalleryRevision: true
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
          customerType: "wedding_couple",
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
  const { admin, gallery } = await requireGuestGallery(galleryId);
  const title = formString(formData, "title");
  const customerId = formString(formData, "customerId");
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

  const customer = customerId
    ? await prisma.customer.findFirst({
        where: {
          id: customerId,
          customerType: "wedding_couple",
          ...adminOwnedWhere(admin)
        },
        select: {
          id: true,
          primaryEmail: true
        }
      })
    : null;

  if (customerId && !customer) {
    redirect(`/admin/guest-galleries/${gallery.id}?error=customer`);
  }

  await prisma.gallery.update({
    where: { id: gallery.id },
    data: {
      title,
      customerId: customer?.id ?? null,
      clientEmail: customer?.primaryEmail.toLowerCase() ?? null,
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
  revalidatePath("/portal/account");
  if (gallery.customerId) {
    revalidatePath(`/admin/clients/${gallery.customerId}`);
  }
  if (customer?.id) {
    revalidatePath(`/admin/clients/${customer.id}`);
  }
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
  const { admin, gallery } = await requireGuestGallery(galleryId);
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
    prisma.guestGalleryAuditLog.create({
      data: {
        galleryId: gallery.id,
        actorType: "admin",
        actorLabel: admin.name,
        action: visible ? "approve" : "hide",
        photoCount: 1,
        photoIds: [upload.id],
        metadata: { adminId: admin.id }
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

export async function getAdminGuestGalleryPhotosPageAction(
  galleryId: string,
  filters: GuestGalleryAdminPhotoFilters,
  cursor?: GuestGalleryAdminPhotoCursor | null
) {
  const { gallery } = await requireGuestGallery(galleryId);
  const normalizedFilters = normalizeGuestGalleryAdminFilters(filters);
  const normalizedCursor = normalizeGuestGalleryAdminCursor(cursor);
  const filteredWhere = buildGuestGalleryAdminPhotoWhere(gallery.id, normalizedFilters);
  const cursorWhere: Prisma.GalleryGuestUploadWhereInput | null = normalizedCursor
    ? {
        OR: [
          { createdAt: { lt: normalizedCursor.createdAt } },
          { createdAt: normalizedCursor.createdAt, id: { lt: normalizedCursor.id } }
        ]
      }
    : null;
  const where = cursorWhere ? { AND: [filteredWhere, cursorWhere] } : filteredWhere;

  const [rows, totalCount] = await Promise.all([
    prisma.galleryGuestUpload.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: ADMIN_GUEST_PHOTO_PAGE_SIZE + 1,
      select: {
        id: true,
        filename: true,
        email: true,
        guestName: true,
        imageUrl: true,
        thumbnailUrl: true,
        previewUrl: true,
        fileSize: true,
        status: true,
        processingStatus: true,
        createdAt: true
      }
    }),
    normalizedCursor
      ? Promise.resolve<number | null>(null)
      : prisma.galleryGuestUpload.count({ where: filteredWhere })
  ]);
  const hasMore = rows.length > ADMIN_GUEST_PHOTO_PAGE_SIZE;
  const page = rows.slice(0, ADMIN_GUEST_PHOTO_PAGE_SIZE);
  const lastPhoto = page.at(-1);

  return {
    ok: true as const,
    photos: page.map(serializeGuestGalleryAdminPhoto),
    nextCursor: hasMore && lastPhoto
      ? { createdAt: lastPhoto.createdAt.toISOString(), id: lastPhoto.id }
      : null,
    totalCount,
    revision: gallery.guestGalleryRevision
  };
}

export async function getAdminGuestGalleryRevisionAction(galleryId: string, knownRevision: number) {
  const { gallery } = await requireGuestGallery(galleryId);

  return {
    ok: true as const,
    unchanged: Number.isInteger(knownRevision) && knownRevision === gallery.guestGalleryRevision,
    revision: gallery.guestGalleryRevision
  };
}

export async function bulkUpdateGuestPhotosAction(
  galleryId: string,
  selection: GuestGalleryAdminSelection,
  operation: "approve" | "hide" | "delete"
): Promise<{ ok: boolean; message: string; changedCount: number }> {
  const { admin, gallery } = await requireGuestGallery(galleryId);

  if (!["approve", "hide", "delete"].includes(operation)) {
    return { ok: false, message: "Érvénytelen tömeges művelet.", changedCount: 0 };
  }

  let selectedWhere: Prisma.GalleryGuestUploadWhereInput;

  if (selection?.mode === "filter") {
    const excludedIds = [...new Set(
      (Array.isArray(selection.excludedIds) ? selection.excludedIds : [])
        .filter((id): id is string => typeof id === "string" && Boolean(id))
    )].slice(0, 5000);
    selectedWhere = {
      AND: [
        buildGuestGalleryAdminPhotoWhere(gallery.id, selection.filters),
        ...(excludedIds.length > 0 ? [{ id: { notIn: excludedIds } }] : [])
      ]
    };
  } else {
    const ids = [...new Set(
      (selection?.mode === "ids" && Array.isArray(selection.ids) ? selection.ids : [])
        .filter((id): id is string => typeof id === "string" && Boolean(id))
    )].slice(0, 5000);

    if (ids.length === 0) {
      return { ok: false, message: "Nincs kijelölt vendégfotó.", changedCount: 0 };
    }

    selectedWhere = { galleryId: gallery.id, id: { in: ids } };
  }

  let changedCount = 0;

  if (operation === "delete") {
    const uploads = await prisma.galleryGuestUpload.findMany({
      where: selectedWhere,
      take: 5000,
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

    changedCount = uploads.length;
    await prisma.$transaction([
      prisma.galleryGuestUpload.deleteMany({
        where: { galleryId: gallery.id, id: { in: uploads.map((upload) => upload.id) } }
      }),
      prisma.guestGalleryAuditLog.create({
        data: {
          galleryId: gallery.id,
          actorType: "admin",
          actorLabel: admin.name,
          action: "delete",
          photoCount: uploads.length,
          photoIds: uploads.map((upload) => upload.id),
          metadata: { adminId: admin.id }
        }
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

    const deleteObjects = async () => {
      const keys = [...objectKeys];

      for (let offset = 0; offset < keys.length; offset += 100) {
        await Promise.allSettled(keys.slice(offset, offset + 100).map((key) => deletePhotoObject(key)));
      }
    };

    try {
      after(deleteObjects);
    } catch {
      void deleteObjects().catch(() => undefined);
    }
  } else {
    changedCount = await prisma.$transaction(async (transaction) => {
      const result = await transaction.galleryGuestUpload.updateMany({
        where: selectedWhere,
        data: {
          status: operation === "approve" ? "visible" : "hidden",
          visibleAt: operation === "approve" ? new Date() : null,
          customerDeletedAt: null,
          customerDeletedByAccountId: null,
          statusBeforeCustomerDelete: null
        }
      });

      if (result.count > 0) {
        await transaction.guestGalleryAuditLog.create({
          data: {
            galleryId: gallery.id,
            actorType: "admin",
            actorLabel: admin.name,
            action: operation,
            photoCount: result.count,
            metadata: { adminId: admin.id }
          }
        });
        await transaction.gallery.update({
          where: { id: gallery.id },
          data: { guestGalleryRevision: { increment: 1 } }
        });
      }

      return result.count;
    });

    if (changedCount === 0) {
      return { ok: false, message: "A kijelölt vendégfotók nem találhatók.", changedCount: 0 };
    }
  }

  revalidatePath(`/admin/guest-galleries/${gallery.id}`);
  revalidatePath(`/g/${gallery.slug}`);

  const message = operation === "delete"
    ? `${changedCount} kép véglegesen törölve.`
    : operation === "approve"
      ? `${changedCount} kép jóváhagyva.`
      : `${changedCount} kép elrejtve.`;

  return { ok: true, message, changedCount };
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

export async function deleteGuestGalleryAction(galleryId: string) {
  const { gallery } = await requireGuestGallery(galleryId);
  const fullGallery = await prisma.gallery.findUnique({
    where: { id: gallery.id },
    select: {
      id: true,
      slug: true,
      customerId: true,
      guestUploads: {
        select: {
          r2Key: true,
          imageUrl: true,
          thumbnailUrl: true,
          previewUrl: true
        }
      },
      photos: {
        select: {
          r2Key: true,
          imageUrl: true,
          thumbnailUrl: true,
          previewUrl: true
        }
      },
      downloadPackages: { select: { r2Key: true } }
    }
  });

  if (!fullGallery) {
    redirect("/admin/guest-galleries?error=missing");
  }

  const objectKeys = new Set([
    ...fullGallery.guestUploads.flatMap((upload) => [
      upload.r2Key,
      getR2KeyFromPublicUrl(upload.imageUrl),
      getR2KeyFromPublicUrl(upload.thumbnailUrl),
      getR2KeyFromPublicUrl(upload.previewUrl)
    ]),
    ...fullGallery.photos.flatMap((photo) => [
      photo.r2Key,
      getR2KeyFromPublicUrl(photo.imageUrl),
      getR2KeyFromPublicUrl(photo.thumbnailUrl),
      getR2KeyFromPublicUrl(photo.previewUrl)
    ]),
    ...fullGallery.downloadPackages.map((downloadPackage) => downloadPackage.r2Key)
  ].filter((key): key is string => Boolean(key)));

  await prisma.gallery.delete({ where: { id: fullGallery.id } });

  const deleteObjects = async () => {
    const keys = [...objectKeys];
    for (let offset = 0; offset < keys.length; offset += 100) {
      await Promise.allSettled(keys.slice(offset, offset + 100).map((key) => deletePhotoObject(key)));
    }
  };

  try {
    after(deleteObjects);
  } catch {
    void deleteObjects().catch(() => undefined);
  }

  revalidatePath("/admin/guest-galleries");
  revalidatePath("/portal/account");
  if (fullGallery.customerId) {
    revalidatePath(`/admin/clients/${fullGallery.customerId}`);
  }
  revalidatePath(`/g/${fullGallery.slug}`);
  redirect("/admin/guest-galleries?deleted=1");
}
