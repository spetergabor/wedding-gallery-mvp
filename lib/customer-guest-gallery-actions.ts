"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import {
  CUSTOMER_GUEST_PHOTO_PAGE_SIZE,
  buildCustomerGuestPhotoWhere,
  normalizeCustomerGuestPhotoCursor,
  normalizeCustomerGuestPhotoFilters,
  serializeCustomerGuestPhoto,
  type CustomerGuestPhotoCursor,
  type CustomerGuestPhotoFilters
} from "@/lib/customer-guest-gallery";
import { requireCustomerPortalSession } from "@/lib/customer-portal-auth";
import { invalidateGuestGalleryDownloadPackages } from "@/lib/download-packages";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_GUEST } from "@/lib/proofing";
import { deletePhotoObject, getR2KeyFromPublicUrl } from "@/lib/storage";

type CustomerGuestPhotoOperation = "approve" | "hide" | "trash" | "restore" | "delete";

async function requireCustomerGuestGallery(galleryId: string) {
  const session = await requireCustomerPortalSession();
  const gallery = await prisma.gallery.findFirst({
    where: {
      id: galleryId,
      customerId: session.account.customer.id,
      galleryMode: GALLERY_MODE_GUEST
    },
    select: {
      id: true,
      slug: true,
      guestGalleryRevision: true
    }
  });

  return gallery ? { session, gallery } : null;
}

export async function getCustomerGuestGalleryPhotosPageAction(
  galleryId: string,
  filters: CustomerGuestPhotoFilters,
  cursor?: CustomerGuestPhotoCursor | null
) {
  const access = await requireCustomerGuestGallery(galleryId);

  if (!access) {
    return { ok: false as const, photos: [], nextCursor: null, totalCount: 0, revision: 0 };
  }

  const normalizedFilters = normalizeCustomerGuestPhotoFilters(filters);
  const normalizedCursor = normalizeCustomerGuestPhotoCursor(cursor);
  const filteredWhere = buildCustomerGuestPhotoWhere(access.gallery.id, normalizedFilters);
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
      take: CUSTOMER_GUEST_PHOTO_PAGE_SIZE + 1,
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
        customerDeletedAt: true,
        createdAt: true
      }
    }),
    normalizedCursor
      ? Promise.resolve<number | null>(null)
      : prisma.galleryGuestUpload.count({ where: filteredWhere })
  ]);
  const hasMore = rows.length > CUSTOMER_GUEST_PHOTO_PAGE_SIZE;
  const page = rows.slice(0, CUSTOMER_GUEST_PHOTO_PAGE_SIZE);
  const lastPhoto = page.at(-1);

  return {
    ok: true as const,
    photos: page.map(serializeCustomerGuestPhoto),
    nextCursor: hasMore && lastPhoto ? { createdAt: lastPhoto.createdAt.toISOString(), id: lastPhoto.id } : null,
    totalCount,
    revision: access.gallery.guestGalleryRevision
  };
}

export async function updateCustomerGuestPhotosAction(
  galleryId: string,
  uploadIds: string[],
  operation: CustomerGuestPhotoOperation
) {
  const access = await requireCustomerGuestGallery(galleryId);

  if (!access || !["approve", "hide", "trash", "restore", "delete"].includes(operation)) {
    return { ok: false as const, changedCount: 0 };
  }

  const ids = [...new Set(
    (Array.isArray(uploadIds) ? uploadIds : [])
      .filter((id): id is string => typeof id === "string" && Boolean(id))
  )].slice(0, 500);

  if (ids.length === 0) {
    return { ok: false as const, changedCount: 0 };
  }

  const uploads = await prisma.galleryGuestUpload.findMany({
    where: { galleryId: access.gallery.id, id: { in: ids } },
    select: {
      id: true,
      status: true,
      statusBeforeCustomerDelete: true,
      customerDeletedAt: true,
      r2Key: true,
      imageUrl: true,
      thumbnailUrl: true,
      previewUrl: true
    }
  });
  let changedCount = 0;

  if (operation === "approve" || operation === "hide") {
    const activeIds = uploads
      .filter((upload) => !upload.customerDeletedAt && upload.status !== "pending")
      .map((upload) => upload.id);

    if (activeIds.length > 0) {
      await prisma.$transaction([
        prisma.galleryGuestUpload.updateMany({
          where: { galleryId: access.gallery.id, id: { in: activeIds } },
          data: {
            status: operation === "approve" ? "visible" : "hidden",
            visibleAt: operation === "approve" ? new Date() : null,
            customerDeletedAt: null,
            customerDeletedByAccountId: null,
            statusBeforeCustomerDelete: null
          }
        }),
        prisma.gallery.update({
          where: { id: access.gallery.id },
          data: { guestGalleryRevision: { increment: 1 } }
        })
      ]);
      changedCount = activeIds.length;
    }
  } else if (operation === "trash") {
    const activeUploads = uploads.filter((upload) => !upload.customerDeletedAt && upload.status !== "pending");
    const statusGroups = new Map<string, string[]>();

    activeUploads.forEach((upload) => {
      const group = statusGroups.get(upload.status) ?? [];
      group.push(upload.id);
      statusGroups.set(upload.status, group);
    });

    if (activeUploads.length > 0) {
      await prisma.$transaction([
        ...[...statusGroups.entries()].map(([status, groupIds]) => prisma.galleryGuestUpload.updateMany({
          where: { galleryId: access.gallery.id, id: { in: groupIds } },
          data: {
            status: "hidden",
            visibleAt: null,
            customerDeletedAt: new Date(),
            customerDeletedByAccountId: access.session.account.id,
            statusBeforeCustomerDelete: status
          }
        })),
        prisma.gallery.update({
          where: { id: access.gallery.id },
          data: { guestGalleryRevision: { increment: 1 } }
        })
      ]);
      changedCount = activeUploads.length;
      await invalidateGuestGalleryDownloadPackages(access.gallery.id);
    }
  } else if (operation === "restore") {
    const trashedUploads = uploads.filter((upload) => Boolean(upload.customerDeletedAt));
    const statusGroups = new Map<string, string[]>();

    trashedUploads.forEach((upload) => {
      const previousStatus = ["visible", "pending_review", "hidden"].includes(upload.statusBeforeCustomerDelete ?? "")
        ? upload.statusBeforeCustomerDelete!
        : "hidden";
      const group = statusGroups.get(previousStatus) ?? [];
      group.push(upload.id);
      statusGroups.set(previousStatus, group);
    });

    if (trashedUploads.length > 0) {
      await prisma.$transaction([
        ...[...statusGroups.entries()].map(([status, groupIds]) => prisma.galleryGuestUpload.updateMany({
          where: { galleryId: access.gallery.id, id: { in: groupIds } },
          data: {
            status,
            visibleAt: status === "visible" ? new Date() : null,
            customerDeletedAt: null,
            customerDeletedByAccountId: null,
            statusBeforeCustomerDelete: null
          }
        })),
        prisma.gallery.update({
          where: { id: access.gallery.id },
          data: { guestGalleryRevision: { increment: 1 } }
        })
      ]);
      changedCount = trashedUploads.length;
      await invalidateGuestGalleryDownloadPackages(access.gallery.id);
    }
  } else {
    const trashedUploads = uploads.filter((upload) => Boolean(upload.customerDeletedAt));

    if (trashedUploads.length > 0) {
      await prisma.$transaction([
        prisma.galleryGuestUpload.deleteMany({
          where: { galleryId: access.gallery.id, id: { in: trashedUploads.map((upload) => upload.id) } }
        }),
        prisma.gallery.update({
          where: { id: access.gallery.id },
          data: { guestGalleryRevision: { increment: 1 } }
        })
      ]);
      changedCount = trashedUploads.length;
      await invalidateGuestGalleryDownloadPackages(access.gallery.id);

      const objectKeys = new Set(
        trashedUploads.flatMap((upload) => [
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
    }
  }

  if (changedCount === 0) {
    return { ok: false as const, changedCount: 0 };
  }

  revalidatePath(`/portal/account/guest-galleries/${access.gallery.id}`);
  revalidatePath(`/g/${access.gallery.slug}`);
  revalidatePath(`/admin/guest-galleries/${access.gallery.id}`);

  return { ok: true as const, changedCount };
}
