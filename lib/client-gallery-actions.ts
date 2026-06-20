"use server";

import { revalidatePath } from "next/cache";
import { invalidatePublicGalleryDownloadPackages } from "@/lib/download-packages";
import { prisma } from "@/lib/prisma";

export async function toggleClientPhotoVisibilityAction({
  galleryId,
  photoId,
  token,
  hidden
}: {
  galleryId: string;
  photoId: string;
  token: string;
  hidden: boolean;
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
      message: "Ez az ügyfél link nem érvényes."
    };
  }

  const photo = await prisma.photo.findFirst({
    where: {
      id: photoId,
      galleryId
    },
    select: {
      id: true
    }
  });

  if (!photo) {
    return {
      ok: false,
      message: "A fotó nem található."
    };
  }

  await prisma.photo.update({
    where: { id: photoId },
    data: {
      isClientHidden: hidden,
      clientHiddenAt: hidden ? new Date() : null
    }
  });
  await invalidatePublicGalleryDownloadPackages(galleryId);

  revalidatePath(`/g/${gallery.slug}`);
  revalidatePath(`/client/${gallery.slug}`);
  revalidatePath(`/admin/galleries/${gallery.id}`);

  return {
    ok: true,
    hidden
  };
}
