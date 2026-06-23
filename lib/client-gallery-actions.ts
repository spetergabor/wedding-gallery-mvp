"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { invalidatePublicGalleryDownloadPackages } from "@/lib/download-packages";
import { kickGalleryZipJobs, preparePublicGalleryZipPackages } from "@/lib/jobs";
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
      message: "Dieser Kundenlink ist nicht gültig."
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
      message: "Das Foto wurde nicht gefunden."
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
  const zipResult = await preparePublicGalleryZipPackages(galleryId);

  if (zipResult.ok && zipResult.payloads.length > 0) {
    after(async () => {
      await kickGalleryZipJobs(zipResult.payloads);
    });
  }

  revalidatePath(`/g/${gallery.slug}`);
  revalidatePath(`/client/${gallery.slug}`);
  revalidatePath(`/admin/galleries/${gallery.id}`);

  return {
    ok: true,
    hidden,
    zipStatus: zipResult.ok ? zipResult.status : null,
    zipRefreshing: zipResult.ok && !zipResult.cached
  };
}
