"use server";

import { revalidatePath } from "next/cache";
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
      slug: true,
      title: true
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
      id: true,
      filename: true,
      isClientHidden: true
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

  if (hidden && !photo.isClientHidden) {
    await prisma.adminNotification.create({
      data: {
        type: "photo_hidden_by_client",
        title: "Ügyfél elrejtett egy képet",
        message: `${photo.filename} el lett rejtve a(z) ${gallery.title} galériában.`,
        href: `/admin/galleries/${gallery.id}`
      }
    });
  }

  revalidatePath(`/g/${gallery.slug}`);
  revalidatePath(`/client/${gallery.slug}`);
  revalidatePath(`/admin/galleries/${gallery.id}`);
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/notifications");

  return {
    ok: true,
    hidden
  };
}
