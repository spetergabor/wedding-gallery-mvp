"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { recordGalleryView } from "@/lib/gallery-view-tracking";
import { createGalleryZipObjectKey, getPhotoPublicUrl, savePhotoObject } from "@/lib/storage";

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

function galleryZipFileName(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "gallery"}.zip`;
}

function photoZipFileName(filename: string, index: number) {
  const fallback = `photo-${String(index + 1).padStart(3, "0")}.jpg`;
  return (filename || fallback).replace(/[\\/:*?"<>|]/g, "-");
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

export async function requestGalleryDownloadPackageAction(galleryId: string, email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return {
      ok: false,
      message: "Bitte gib eine gültige E-Mail-Adresse ein.",
      downloadUrl: null,
      filename: null,
      cached: false
    };
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: {
      id: true,
      title: true,
      slug: true,
      isActive: true,
      photos: {
        where: { isClientHidden: false },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          filename: true,
          imageUrl: true,
          createdAt: true
        }
      }
    }
  });

  if (!gallery || !gallery.isActive) {
    return {
      ok: false,
      message: "Diese Galerie ist derzeit nicht verfügbar.",
      downloadUrl: null,
      filename: null,
      cached: false
    };
  }

  if (gallery.photos.length === 0) {
    return {
      ok: false,
      message: "Diese Galerie enthält noch keine Fotos.",
      downloadUrl: null,
      filename: null,
      cached: false
    };
  }

  const latestPhotoCreatedAt = gallery.photos.reduce<Date | null>((latest, photo) => {
    if (!latest || photo.createdAt > latest) {
      return photo.createdAt;
    }

    return latest;
  }, null);

  const existingPackage = await prisma.galleryDownloadPackage.findFirst({
    where: {
      galleryId,
      status: "completed",
      photoCount: gallery.photos.length,
      downloadUrl: { not: null },
      generatedAt: latestPhotoCreatedAt ? { gte: latestPhotoCreatedAt } : undefined
    },
    orderBy: { generatedAt: "desc" },
    select: {
      downloadUrl: true,
      r2Key: true
    }
  });

  await prisma.galleryDownload.create({
    data: {
      galleryId,
      email: normalizedEmail
    }
  });

  if (existingPackage?.downloadUrl) {
    return {
      ok: true,
      message: "Download ist bereit.",
      downloadUrl: existingPackage.downloadUrl,
      filename: galleryZipFileName(gallery.title),
      cached: true
    };
  }

  const downloadPackage = await prisma.galleryDownloadPackage.create({
    data: {
      galleryId,
      status: "processing",
      photoCount: gallery.photos.length
    },
    select: { id: true }
  });

  try {
    const zip = new JSZip();

    for (const [index, photo] of gallery.photos.entries()) {
      const response = await fetch(photo.imageUrl, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`${photo.filename} konnte nicht geladen werden.`);
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      zip.file(photoZipFileName(photo.filename, index), bytes);
    }

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "STORE"
    });
    const r2Key = createGalleryZipObjectKey({ gallerySlug: gallery.slug });
    const downloadUrl = getPhotoPublicUrl(r2Key);

    await savePhotoObject({
      r2Key,
      bytes: zipBuffer,
      contentType: "application/zip"
    });

    await prisma.galleryDownloadPackage.update({
      where: { id: downloadPackage.id },
      data: {
        status: "completed",
        photoCount: gallery.photos.length,
        fileSize: zipBuffer.length,
        r2Key,
        downloadUrl,
        errorMessage: null,
        generatedAt: new Date()
      }
    });

    revalidatePath(`/admin/galleries/${galleryId}`);

    return {
      ok: true,
      message: "Download ist bereit.",
      downloadUrl,
      filename: galleryZipFileName(gallery.title),
      cached: false
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die ZIP-Datei konnte nicht erstellt werden.";

    await prisma.galleryDownloadPackage.update({
      where: { id: downloadPackage.id },
      data: {
        status: "failed",
        errorMessage: message.slice(0, 500)
      }
    });

    return {
      ok: false,
      message,
      downloadUrl: null,
      filename: null,
      cached: false
    };
  }
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
  const result = await recordGalleryView({
    galleryId,
    headers: requestHeaders
  });

  return {
    ok: true,
    viewId: result.viewId
  };
}

function coordinateInRange(value: number, min: number, max: number) {
  return Number.isFinite(value) && value >= min && value <= max;
}

async function reverseGeocode(latitude: number, longitude: number) {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("zoom", "12");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "WeddingGalleryMVP/1.0 (gallery.hochzeitsfotografgraz.at)"
      },
      next: { revalidate: 60 * 60 * 24 * 30 }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const address = data?.address ?? {};
    const city =
      address.city ??
      address.town ??
      address.village ??
      address.municipality ??
      address.county ??
      null;

    return {
      city: typeof city === "string" ? city : null,
      region: typeof address.state === "string" ? address.state : null,
      country: typeof address.country_code === "string" ? address.country_code.toUpperCase() : null
    };
  } catch {
    return null;
  }
}

export async function updateGalleryViewLocationAction({
  galleryId,
  viewId,
  latitude,
  longitude
}: {
  galleryId: string;
  viewId: string;
  latitude: number;
  longitude: number;
}) {
  if (!viewId || !coordinateInRange(latitude, -90, 90) || !coordinateInRange(longitude, -180, 180)) {
    return { ok: false };
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { id: true, isActive: true }
  });

  if (!gallery || !gallery.isActive) {
    return { ok: false };
  }

  const location = await reverseGeocode(latitude, longitude);

  await prisma.galleryView.updateMany({
    where: {
      id: viewId,
      galleryId
    },
    data: {
      latitude,
      longitude,
      city: location?.city ?? null,
      region: location?.region ?? null,
      country: location?.country ?? null
    }
  });

  return { ok: true };
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
      submittedAt: true,
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
      submittedAt: list.submittedAt?.toISOString() ?? null,
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
      submittedAt: true,
      items: { select: { photoId: true } }
    }
  });

  if (existingList) {
    return {
      ok: true,
      list: {
        id: existingList.id,
        name: existingList.name,
        submittedAt: existingList.submittedAt?.toISOString() ?? null,
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
      name: true,
      submittedAt: true
    }
  });

  return {
    ok: true,
    list: {
      id: list.id,
      name: list.name,
      submittedAt: list.submittedAt?.toISOString() ?? null,
      photoIds: []
    }
  };
}

export async function submitFavoriteListAction(galleryId: string, email: string, listId: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return {
      ok: false,
      message: "Bitte gib eine gültige E-Mail-Adresse ein.",
      submittedAt: null
    };
  }

  const list = await prisma.galleryFavoriteList.findFirst({
    where: {
      id: listId,
      galleryId,
      email: normalizedEmail,
      gallery: { isActive: true }
    },
    select: {
      id: true,
      name: true,
      submittedAt: true,
      gallery: {
        select: {
          title: true
        }
      },
      _count: {
        select: {
          items: true
        }
      }
    }
  });

  if (!list) {
    return {
      ok: false,
      message: "Diese Favoritenliste konnte nicht gefunden werden.",
      submittedAt: null
    };
  }

  if (list._count.items === 0) {
    return {
      ok: false,
      message: "Bitte wähle zuerst mindestens ein Foto aus.",
      submittedAt: null
    };
  }

  const submittedAt = new Date();

  await prisma.galleryFavoriteList.update({
    where: { id: list.id },
    data: { submittedAt }
  });

  await prisma.adminNotification.create({
    data: {
      type: "favorite_list_submitted",
      title: "Kedvenc lista lezárva",
      message: `${normalizedEmail} lezárta a(z) ${list.name} listát a(z) ${list.gallery.title} galériában.`,
      href: `/admin/galleries/${galleryId}`
    }
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/notifications");
  revalidatePath(`/admin/galleries/${galleryId}`);

  return {
    ok: true,
    message: "Die Auswahl wurde gespeichert.",
    submittedAt: submittedAt.toISOString()
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
