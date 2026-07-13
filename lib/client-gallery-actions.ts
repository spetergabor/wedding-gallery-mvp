"use server";

import { revalidatePath } from "next/cache";
import { invalidatePublicGalleryDownloadPackages } from "@/lib/download-packages";
import { prisma } from "@/lib/prisma";

export async function saveClientPhotoVisibilityChangesAction({
  galleryId,
  token,
  reviewedPhotoIds,
  hiddenPhotoIds
}: {
  galleryId: string;
  token: string;
  reviewedPhotoIds: string[];
  hiddenPhotoIds: string[];
}) {
  const gallery = await prisma.gallery.findFirst({
    where: {
      id: galleryId,
      clientAccessToken: token
    },
    select: {
      id: true,
      slug: true
    }
  });

  if (!gallery) {
    return {
      ok: false,
      message: "Dieser Kundenlink ist nicht gültig."
    };
  }

  const photos = await prisma.photo.findMany({
    where: { galleryId },
    select: { id: true }
  });
  const validPhotoIds = new Set(photos.map((photo) => photo.id));
  const nextReviewedPhotoIds = Array.from(new Set(reviewedPhotoIds)).filter((photoId) => validPhotoIds.has(photoId));
  const nextHiddenPhotoIds = Array.from(new Set(hiddenPhotoIds)).filter((photoId) => validPhotoIds.has(photoId));

  if (nextReviewedPhotoIds.length !== reviewedPhotoIds.length || nextHiddenPhotoIds.length !== hiddenPhotoIds.length) {
    return {
      ok: false,
      message: "Einige Fotos konnten nicht zugeordnet werden."
    };
  }

  const reviewedPhotoIdSet = new Set(nextReviewedPhotoIds);

  if (nextHiddenPhotoIds.some((photoId) => !reviewedPhotoIdSet.has(photoId))) {
    return {
      ok: false,
      message: "Einige Fotos konnten nicht zugeordnet werden."
    };
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.photo.updateMany({
      where: {
        galleryId,
        id: { in: nextHiddenPhotoIds }
      },
      data: {
        isClientHidden: true,
        clientHiddenAt: now
      }
    }),
    prisma.photo.updateMany({
      where: {
        galleryId,
        id: { in: nextReviewedPhotoIds.filter((photoId) => !nextHiddenPhotoIds.includes(photoId)) }
      },
      data: {
        isClientHidden: false,
        clientHiddenAt: null
      }
    })
  ]);
  await invalidatePublicGalleryDownloadPackages(galleryId);

  revalidatePath(`/g/${gallery.slug}`);
  revalidatePath(`/client/${gallery.slug}`);
  revalidatePath(`/admin/galleries/${gallery.id}`);

  return {
    ok: true,
    hiddenCount: nextHiddenPhotoIds.length,
    zipNeedsManualRefresh: true
  };
}
