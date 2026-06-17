"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recordGalleryView } from "@/lib/gallery-view-tracking";

function galleryCookie(slug: string) {
  return `wgm_gallery_${slug}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeListName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 80) || "Favoriten";
}

export async function canViewGallery(slug: string, password: string | null) {
  if (!password) {
    return true;
  }

  const cookieStore = await cookies();
  return cookieStore.get(galleryCookie(slug))?.value === "unlocked";
}

export async function unlockGalleryAction(slug: string, formData: FormData) {
  const value = formData.get("password");
  const password = typeof value === "string" ? value : "";
  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    select: { password: true }
  });

  if (!gallery || gallery.password !== password) {
    redirect(`/g/${slug}?error=1`);
  }

  const cookieStore = await cookies();
  cookieStore.set(galleryCookie(slug), "unlocked", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/g/${slug}`,
    maxAge: 60 * 60 * 24
  });

  redirect(`/g/${slug}`);
}

export async function recordGalleryDownloadAction(galleryId: string, email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return {
      ok: false,
      message: "Bitte gib eine gültige E-Mail-Adresse ein."
    };
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { id: true, isActive: true }
  });

  if (!gallery || !gallery.isActive) {
    return {
      ok: false,
      message: "Diese Galerie ist derzeit nicht verfügbar."
    };
  }

  await prisma.galleryDownload.create({
    data: {
      galleryId,
      email: normalizedEmail
    }
  });

  return {
    ok: true,
    message: "E-Mail gespeichert."
  };
}

export async function recordGalleryViewAction(galleryId: string) {
  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { id: true, isActive: true }
  });

  if (!gallery || !gallery.isActive) {
    return {
      ok: false
    };
  }

  const requestHeaders = await headers();
  await recordGalleryView({
    galleryId,
    headers: requestHeaders
  });

  return {
    ok: true
  };
}

export async function getFavoriteListsAction(galleryId: string, email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return {
      ok: false,
      message: "Bitte gib eine gültige E-Mail-Adresse ein.",
      lists: []
    };
  }

  const lists = await prisma.galleryFavoriteList.findMany({
    where: { galleryId, email: normalizedEmail },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      items: {
        select: { photoId: true }
      }
    }
  });

  return {
    ok: true,
    lists: lists.map((list) => ({
      id: list.id,
      name: list.name,
      photoIds: list.items.map((item) => item.photoId)
    }))
  };
}

export async function createFavoriteListAction(galleryId: string, email: string, name: string) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeListName(name);

  if (!isValidEmail(normalizedEmail)) {
    return {
      ok: false,
      message: "Bitte gib eine gültige E-Mail-Adresse ein.",
      list: null
    };
  }

  const existingList = await prisma.galleryFavoriteList.findFirst({
    where: {
      galleryId,
      email: normalizedEmail,
      name: normalizedName
    },
    select: {
      id: true,
      name: true,
      items: { select: { photoId: true } }
    }
  });

  if (existingList) {
    return {
      ok: true,
      list: {
        id: existingList.id,
        name: existingList.name,
        photoIds: existingList.items.map((item) => item.photoId)
      }
    };
  }

  const list = await prisma.galleryFavoriteList.create({
    data: {
      galleryId,
      email: normalizedEmail,
      name: normalizedName
    },
    select: {
      id: true,
      name: true
    }
  });

  return {
    ok: true,
    list: {
      id: list.id,
      name: list.name,
      photoIds: []
    }
  };
}

export async function toggleFavoritePhotoAction(galleryId: string, photoId: string, email: string, listId?: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return {
      ok: false,
      message: "Bitte gib eine gültige E-Mail-Adresse ein."
    };
  }

  const photo = await prisma.photo.findFirst({
    where: {
      id: photoId,
      galleryId,
      gallery: { isActive: true }
    },
    select: {
      id: true,
      gallery: {
        select: {
          title: true
        }
      }
    }
  });

  if (!photo) {
    return {
      ok: false,
      message: "Das Foto wurde nicht gefunden."
    };
  }

  const existingList = await prisma.galleryFavoriteList.findFirst({
    where: listId
      ? { id: listId, galleryId, email: normalizedEmail }
      : { galleryId, email: normalizedEmail, name: "Favoriten" },
    select: {
      id: true,
      name: true,
      _count: {
        select: { items: true }
      }
    }
  });

  const list =
    existingList ??
    (await prisma.galleryFavoriteList.create({
      data: {
        galleryId,
        email: normalizedEmail,
        name: "Favoriten"
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: { items: true }
        }
      }
    }));

  const existingItem = await prisma.galleryFavoriteItem.findUnique({
    where: {
      listId_photoId: {
        listId: list.id,
        photoId
      }
    },
    select: { id: true }
  });

  if (existingItem) {
    await prisma.galleryFavoriteItem.delete({
      where: { id: existingItem.id }
    });

    await prisma.galleryFavoriteList.update({
      where: { id: list.id },
      data: {
        updatedAt: new Date()
      }
    });

    const count = await prisma.galleryFavoriteItem.count({
      where: { listId: list.id }
    });

    return {
      ok: true,
      isFavorite: false,
      listId: list.id,
      listName: list.name,
      count
    };
  }

  await prisma.galleryFavoriteItem.create({
    data: {
      listId: list.id,
      photoId
    }
  });

  await prisma.galleryFavoriteList.update({
    where: { id: list.id },
    data: {
      updatedAt: new Date()
    }
  });

  const count = await prisma.galleryFavoriteItem.count({
    where: { listId: list.id }
  });

  if (list._count.items === 0 && count === 1) {
    await prisma.adminNotification.create({
      data: {
        type: "favorite_list_created",
        title: "Új kedvenc lista",
        message: `${normalizedEmail} kedvenc listát kezdett a(z) ${photo.gallery.title} galériában.`,
        href: `/admin/galleries/${galleryId}`
      }
    });

    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/notifications");
  }

  return {
    ok: true,
    isFavorite: true,
    listId: list.id,
    listName: list.name,
    count
  };
}
