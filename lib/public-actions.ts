"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { recordGalleryView } from "@/lib/gallery-view-tracking";
import { adminGalleryUrl, sendAdminFavoriteListSubmittedEmail } from "@/lib/email";
import { enqueueGalleryZipJob, processPendingJobs } from "@/lib/jobs";

const ZIP_PART_SIZE = 100;
const STALE_ZIP_PROCESSING_MS = 15 * 60 * 1000;

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

function galleryZipFileName(title: string, partIndex?: number, partCount?: number) {
  const baseName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "gallery";

  if (partCount && partCount > 1 && partIndex !== undefined) {
    return `${baseName}-teil-${String(partIndex + 1).padStart(2, "0")}-von-${String(partCount).padStart(2, "0")}.zip`;
  }

  return `${baseName}.zip`;
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
      cached: false,
      packageId: null,
      status: "failed",
      packages: []
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
      cached: false,
      packageId: null,
      status: "failed",
      packages: []
    };
  }

  if (gallery.photos.length === 0) {
    return {
      ok: false,
      message: "Diese Galerie enthält noch keine Fotos.",
      downloadUrl: null,
      filename: null,
      cached: false,
      packageId: null,
      status: "failed",
      packages: []
    };
  }

  const latestPhotoCreatedAt = gallery.photos.reduce<Date | null>((latest, photo) => {
    if (!latest || photo.createdAt > latest) {
      return photo.createdAt;
    }

    return latest;
  }, null);

  const partCount = Math.max(1, Math.ceil(gallery.photos.length / ZIP_PART_SIZE));
  const existingPackage =
    partCount === 1
      ? await prisma.galleryDownloadPackage.findFirst({
          where: {
            galleryId,
            status: "completed",
            photoCount: gallery.photos.length,
            partCount: 1,
            downloadUrl: { not: null },
            generatedAt: latestPhotoCreatedAt ? { gte: latestPhotoCreatedAt } : undefined
          },
          orderBy: { generatedAt: "desc" },
          select: {
            id: true,
            downloadUrl: true,
            r2Key: true
          }
        })
      : null;

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
      cached: true,
      packageId: existingPackage.id,
      status: "completed",
      packages: [
        {
          downloadUrl: existingPackage.downloadUrl,
          filename: galleryZipFileName(gallery.title),
          label: "ZIP"
        }
      ]
    };
  }

  const existingPendingPackage = await prisma.galleryDownloadPackage.findFirst({
    where: {
      galleryId,
      status: { in: ["pending", "processing"] },
      photoCount: gallery.photos.length,
      partCount
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      groupId: true
    }
  });

  if (existingPendingPackage) {
    if (existingPendingPackage.status === "pending") {
      after(async () => {
        await processPendingJobs({ limit: 1 });
      });
    }

    return {
      ok: true,
      message: "Download-Paket wird vorbereitet.",
      downloadUrl: null,
      filename: galleryZipFileName(gallery.title),
      cached: false,
      packageId: existingPendingPackage.id,
      status: existingPendingPackage.status,
      packages: []
    };
  }

  const groupId = randomUUID();
  const downloadPackages = [];

  for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
    const photoOffset = partIndex * ZIP_PART_SIZE;
    const photoLimit = Math.min(ZIP_PART_SIZE, gallery.photos.length - photoOffset);
    const downloadPackage = await prisma.galleryDownloadPackage.create({
      data: {
        galleryId,
        status: "pending",
        photoCount: gallery.photos.length,
        partIndex,
        partCount,
        photoOffset,
        photoLimit,
        groupId
      },
      select: { id: true }
    });

    downloadPackages.push(downloadPackage);

    await enqueueGalleryZipJob({
      galleryId,
      packageId: downloadPackage.id
    });
  }

  after(async () => {
    await processPendingJobs({ limit: 1 });
  });

  return {
    ok: true,
    message: "Download-Paket wird vorbereitet.",
    downloadUrl: null,
    filename: galleryZipFileName(gallery.title),
    cached: false,
    packageId: downloadPackages[0]?.id ?? null,
    status: "pending",
    packages: []
  };
}

export async function getGalleryDownloadPackageAction(packageId: string) {
  const downloadPackage = await prisma.galleryDownloadPackage.findUnique({
    where: { id: packageId },
    select: {
      id: true,
      status: true,
      downloadUrl: true,
      errorMessage: true,
      groupId: true,
      partIndex: true,
      partCount: true,
      updatedAt: true,
      gallery: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  if (!downloadPackage) {
    return {
      ok: false,
      message: "Download-Paket wurde nicht gefunden.",
      status: "failed",
      downloadUrl: null,
      filename: null,
      packages: []
    };
  }

  if (downloadPackage.groupId) {
    const packages = await prisma.galleryDownloadPackage.findMany({
      where: { groupId: downloadPackage.groupId },
      orderBy: { partIndex: "asc" },
      select: {
        id: true,
        status: true,
        downloadUrl: true,
        errorMessage: true,
        partIndex: true,
        partCount: true,
        updatedAt: true
      }
    });
    const failedPackage = packages.find((downloadPart) => downloadPart.status === "failed");

    if (failedPackage) {
      return {
        ok: false,
        message: failedPackage.errorMessage || "Die ZIP-Datei konnte nicht erstellt werden.",
        status: "failed",
        downloadUrl: null,
        filename: galleryZipFileName(downloadPackage.gallery.title),
        packages: []
      };
    }

    const completedPackages = packages.filter((downloadPart) => downloadPart.status === "completed" && downloadPart.downloadUrl);

    if (completedPackages.length === packages.length && packages.length > 0) {
      return {
        ok: true,
        message: "Download ist bereit.",
        status: "completed",
        downloadUrl: completedPackages[0]?.downloadUrl ?? null,
        filename: galleryZipFileName(downloadPackage.gallery.title),
        packages: completedPackages.map((downloadPart) => ({
          downloadUrl: downloadPart.downloadUrl,
          filename: galleryZipFileName(downloadPackage.gallery.title, downloadPart.partIndex, downloadPart.partCount),
          label: `Teil ${downloadPart.partIndex + 1}/${downloadPart.partCount}`
        }))
      };
    }

    const staleProcessingCutoff = Date.now() - STALE_ZIP_PROCESSING_MS;
    const hasProcessingPackage = packages.some(
      (downloadPart) => downloadPart.status === "processing" && downloadPart.updatedAt.getTime() >= staleProcessingCutoff
    );
    const hasStaleProcessingPackage = packages.some(
      (downloadPart) => downloadPart.status === "processing" && downloadPart.updatedAt.getTime() < staleProcessingCutoff
    );
    const hasPendingPackage = packages.some((downloadPart) => downloadPart.status === "pending");

    if (!hasProcessingPackage && (hasPendingPackage || hasStaleProcessingPackage)) {
      after(async () => {
        await processPendingJobs({ limit: 1 });
      });
    }

    return {
      ok: true,
      message: "Download-Paket wird vorbereitet.",
      status: hasProcessingPackage ? "processing" : "pending",
      downloadUrl: null,
      filename: galleryZipFileName(downloadPackage.gallery.title),
      packages: []
    };
  }

  if (downloadPackage.status === "completed" && downloadPackage.downloadUrl) {
    return {
      ok: true,
      message: "Download ist bereit.",
      status: "completed",
      downloadUrl: downloadPackage.downloadUrl,
      filename: galleryZipFileName(downloadPackage.gallery.title),
      packages: [
        {
          downloadUrl: downloadPackage.downloadUrl,
          filename: galleryZipFileName(downloadPackage.gallery.title),
          label: "ZIP"
        }
      ]
    };
  }

  if (downloadPackage.status === "failed") {
    return {
      ok: false,
      message: downloadPackage.errorMessage || "Die ZIP-Datei konnte nicht erstellt werden.",
      status: "failed",
      downloadUrl: null,
      filename: galleryZipFileName(downloadPackage.gallery.title),
      packages: []
    };
  }

  const isStaleProcessing =
    downloadPackage.status === "processing" && downloadPackage.updatedAt.getTime() < Date.now() - STALE_ZIP_PROCESSING_MS;

  if (downloadPackage.status === "pending" || isStaleProcessing) {
    after(async () => {
      await processPendingJobs({ limit: 1 });
    });
  }

  return {
    ok: true,
    message: "Download-Paket wird vorbereitet.",
    status: downloadPackage.status,
    downloadUrl: null,
    filename: galleryZipFileName(downloadPackage.gallery.title),
    packages: []
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
          title: true,
          adminId: true,
          admin: {
            select: {
              email: true,
              siteSettings: {
                select: {
                  contactEmail: true
                }
              }
            }
          }
        }
      },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          photo: {
            select: {
              filename: true
            }
          }
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
      adminId: list.gallery.adminId,
      type: "favorite_list_submitted",
      title: "Kedvenc lista lezárva",
      message: `${normalizedEmail} lezárta a(z) ${list.name} listát a(z) ${list.gallery.title} galériában.`,
      href: `/admin/galleries/${galleryId}`
    }
  });

  try {
    await sendAdminFavoriteListSubmittedEmail({
      to: list.gallery.admin?.siteSettings?.contactEmail || list.gallery.admin?.email,
      galleryTitle: list.gallery.title,
      galleryAdminUrl: adminGalleryUrl(galleryId),
      clientEmail: normalizedEmail,
      listName: list.name,
      filenames: list.items.map((item) => item.photo.filename),
      submittedAt
    });
  } catch (error) {
    console.error("Admin favorite list email failed", {
      galleryId,
      listId: list.id,
      error
    });
  }

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
          title: true,
          adminId: true
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
        adminId: photo.gallery.adminId,
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
