"use server";

import { cookies } from "next/headers";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PUBLIC_DOWNLOAD_SCOPE } from "@/lib/download-packages";
import { recordGalleryView } from "@/lib/gallery-view-tracking";
import { adminGalleryUrl, sendAdminFavoriteListSubmittedEmail } from "@/lib/email";
import { enqueueGalleryZipJob, kickGalleryZipJobs, sendGalleryDownloadLinksForPackages } from "@/lib/jobs";
import {
  PHOTO_DELIVERY_STAGE_FINAL,
  PROOFING_STATUS_DELIVERED,
  PROOFING_STATUS_IN_PROGRESS,
  PROOFING_STATUS_NOT_OPENED,
  PROOFING_STATUS_PROCESSING,
  PROOFING_STATUS_SUBMITTED,
  isProofingGallery
} from "@/lib/proofing";

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

function favoritesDisabledForGallery(gallery: { galleryMode: string; proofingStatus: string }) {
  return isProofingGallery(gallery.galleryMode) && gallery.proofingStatus === PROOFING_STATUS_DELIVERED;
}

function galleryZipFileName(title: string, partIndex?: number, partCount?: number) {
  const baseName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "gallery";

  if (partCount && partCount > 1 && partIndex !== undefined) {
    return `${baseName}-teil-${String(partIndex + 1).padStart(2, "0")}-von-${String(partCount).padStart(2, "0")}.zip`;
  }

  return `${baseName}.zip`;
}

function readPositiveMegabytes(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback * 1024 * 1024;
  }

  return parsed * 1024 * 1024;
}

const ZIP_PART_TARGET_BYTES = readPositiveMegabytes(process.env.GALLERY_ZIP_PART_TARGET_MB, 2048, 256);

function createZipPartRanges(photos: Array<{ fileSize: number | null }>) {
  const ranges: Array<{ offset: number; limit: number }> = [];
  let offset = 0;
  let currentBytes = 0;
  let currentCount = 0;

  for (const photo of photos) {
    const size = photo.fileSize && photo.fileSize > 0 ? photo.fileSize : 25 * 1024 * 1024;

    if (currentCount > 0 && currentBytes + size > ZIP_PART_TARGET_BYTES) {
      ranges.push({ offset, limit: currentCount });
      offset += currentCount;
      currentBytes = 0;
      currentCount = 0;
    }

    currentBytes += size;
    currentCount += 1;
  }

  if (currentCount > 0) {
    ranges.push({ offset, limit: currentCount });
  }

  return ranges.length > 0 ? ranges : [{ offset: 0, limit: photos.length }];
}

function isCompletePackageSet(packages: Array<{ status: string; downloadUrl: string | null; partIndex: number; partCount: number }>) {
  if (packages.length === 0) {
    return false;
  }

  const expectedPartCount = Math.max(...packages.map((downloadPackage) => downloadPackage.partCount), packages.length, 1);
  const partIndexes = new Set(
    packages
      .filter((downloadPackage) => downloadPackage.status === "completed" && downloadPackage.downloadUrl)
      .map((downloadPackage) => downloadPackage.partIndex)
  );

  return packages.length === expectedPartCount && Array.from({ length: expectedPartCount }, (_, index) => partIndexes.has(index)).every(Boolean);
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
      galleryMode: true,
      proofingStatus: true,
      downloadsEnabled: true,
      photos: {
        where: { isClientHidden: false, deliveryStage: PHOTO_DELIVERY_STAGE_FINAL },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          createdAt: true,
          fileSize: true
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

  if (!gallery.downloadsEnabled) {
    return {
      ok: false,
      message: "Downloads sind für diese Galerie derzeit deaktiviert.",
      downloadUrl: null,
      filename: null,
      cached: false,
      packageId: null,
      status: "failed",
      packages: []
    };
  }

  if (isProofingGallery(gallery.galleryMode) && gallery.proofingStatus !== PROOFING_STATUS_DELIVERED) {
    return {
      ok: false,
      message: "Die finalen Fotos sind noch nicht freigegeben.",
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

  const completedPackages = await prisma.galleryDownloadPackage.findMany({
    where: {
      galleryId,
      scope: PUBLIC_DOWNLOAD_SCOPE,
      status: "completed",
      photoCount: gallery.photos.length,
      downloadUrl: { not: null },
      r2Key: { not: null },
      generatedAt: latestPhotoCreatedAt ? { gte: latestPhotoCreatedAt } : undefined
    },
    orderBy: [{ groupId: "desc" }, { partIndex: "asc" }, { generatedAt: "desc" }],
    select: {
      id: true,
      status: true,
      downloadUrl: true,
      groupId: true,
      partIndex: true,
      partCount: true
    }
  });
  const completedGroups = new Map<string, typeof completedPackages>();

  for (const downloadPackage of completedPackages) {
    const key = downloadPackage.groupId ?? downloadPackage.id;
    completedGroups.set(key, [...(completedGroups.get(key) ?? []), downloadPackage]);
  }

  let activePackages = Array.from(completedGroups.values()).find(isCompletePackageSet) ?? null;
  let packageStatus = "completed";
  let cached = Boolean(activePackages);

  if (!activePackages) {
    const activePendingPackages = await prisma.galleryDownloadPackage.findMany({
      where: {
        galleryId,
        scope: PUBLIC_DOWNLOAD_SCOPE,
        status: { in: ["pending", "processing"] },
        photoCount: gallery.photos.length
      },
      orderBy: [{ groupId: "desc" }, { partIndex: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        downloadUrl: true,
        groupId: true,
        partIndex: true,
        partCount: true
      }
    });
    const pendingGroups = new Map<string, typeof activePendingPackages>();

    for (const downloadPackage of activePendingPackages) {
      const key = downloadPackage.groupId ?? downloadPackage.id;
      pendingGroups.set(key, [...(pendingGroups.get(key) ?? []), downloadPackage]);
    }

    activePackages = Array.from(pendingGroups.values())[0] ?? null;
    packageStatus = activePackages?.some((downloadPackage) => downloadPackage.status === "processing") ? "processing" : "pending";

    if (activePackages) {
      const pendingPayloads = await Promise.all(
        activePackages
          .filter((downloadPackage) => downloadPackage.status === "pending")
          .map(async (downloadPackage) => ({
            galleryId,
            packageId: downloadPackage.id,
            jobId: (await enqueueGalleryZipJob({ galleryId, packageId: downloadPackage.id })).id
          }))
      );

      after(async () => {
        await kickGalleryZipJobs(pendingPayloads);
      });
    }
  }

  if (!activePackages) {
    const ranges = createZipPartRanges(gallery.photos);
    const partCount = ranges.length;
    const groupId = partCount > 1 ? randomUUID() : null;
    const createdPackages = await prisma.$transaction(
      ranges.map((range, partIndex) =>
        prisma.galleryDownloadPackage.create({
          data: {
            galleryId,
            scope: PUBLIC_DOWNLOAD_SCOPE,
            status: "pending",
            photoCount: gallery.photos.length,
            partIndex,
            partCount,
            photoOffset: range.offset,
            photoLimit: range.limit,
            groupId
          },
          select: {
            id: true,
            status: true,
            downloadUrl: true,
            groupId: true,
            partIndex: true,
            partCount: true
          }
        })
      )
    );
    const payloads = await Promise.all(
      createdPackages.map(async (downloadPackage) => ({
        galleryId,
        packageId: downloadPackage.id,
        jobId: (await enqueueGalleryZipJob({ galleryId, packageId: downloadPackage.id })).id
      }))
    );

    after(async () => {
      await kickGalleryZipJobs(payloads);
    });

    activePackages = createdPackages;
    packageStatus = "pending";
    cached = false;
  }

  await prisma.galleryDownload.createMany({
    data: activePackages.map((downloadPackage) => ({
      galleryId,
      packageId: downloadPackage.id,
      email: normalizedEmail,
      status: "waiting"
    }))
  });

  if (packageStatus === "completed") {
    after(async () => {
      await sendGalleryDownloadLinksForPackages(activePackages.map((downloadPackage) => downloadPackage.id));
    });
  }

  return {
    ok: true,
    message:
      packageStatus === "completed"
        ? "Die Download-Links werden in einer E-Mail gesendet."
        : "Die ZIP-Teile werden vorbereitet. Du bekommst eine E-Mail mit allen Download-Links.",
    downloadUrl: null,
    filename: galleryZipFileName(gallery.title),
    cached,
    packageId: activePackages[0]?.id ?? null,
    status: packageStatus,
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
        message: "Die Download-Links wurden in einer E-Mail gesendet.",
        status: "completed",
        downloadUrl: null,
        filename: galleryZipFileName(downloadPackage.gallery.title),
        packages: []
      };
    }

    const hasProcessingPackage = packages.some((downloadPart) => downloadPart.status === "processing");
    const hasPendingPackage = packages.some((downloadPart) => downloadPart.status === "pending");

    return {
      ok: true,
      message: "Die ZIP-Teile werden vorbereitet. Du bekommst eine E-Mail mit allen Download-Links.",
      status: hasProcessingPackage ? "processing" : hasPendingPackage ? "pending" : "failed",
      downloadUrl: null,
      filename: galleryZipFileName(downloadPackage.gallery.title),
      packages: []
    };
  }

  if (downloadPackage.status === "completed" && downloadPackage.downloadUrl) {
    return {
      ok: true,
      message: "Die Download-Links wurden in einer E-Mail gesendet.",
      status: "completed",
      downloadUrl: null,
      filename: galleryZipFileName(downloadPackage.gallery.title),
      packages: []
    };
  }

  if (downloadPackage.status === "stale") {
    return {
      ok: false,
      message: "Die Galerie wurde aktualisiert. Bitte fordere den Download erneut an.",
      status: "failed",
      downloadUrl: null,
      filename: galleryZipFileName(downloadPackage.gallery.title),
      packages: []
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

  return {
    ok: true,
    message: "Die ZIP-Teile werden vorbereitet. Du bekommst eine E-Mail mit allen Download-Links.",
    status: downloadPackage.status,
    downloadUrl: null,
    filename: galleryZipFileName(downloadPackage.gallery.title),
    packages: []
  };
}

export async function recordGalleryViewAction(galleryId: string) {
  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { id: true, isActive: true, galleryMode: true, proofingStatus: true }
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

  if (isProofingGallery(gallery.galleryMode) && gallery.proofingStatus === PROOFING_STATUS_NOT_OPENED) {
    await prisma.gallery.update({
      where: { id: galleryId },
      data: {
        proofingStatus: PROOFING_STATUS_IN_PROGRESS,
        proofingStatusUpdatedAt: new Date()
      }
    });
  }

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

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { isActive: true, galleryMode: true, proofingStatus: true }
  });

  if (!gallery?.isActive || favoritesDisabledForGallery(gallery)) {
    return {
      ok: false,
      message: "Die Bildauswahl ist für diese Galerie nicht aktiv.",
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

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { isActive: true, galleryMode: true, proofingStatus: true }
  });

  if (!gallery?.isActive || favoritesDisabledForGallery(gallery)) {
    return {
      ok: false,
      message: "Die Bildauswahl ist für diese Galerie nicht aktiv.",
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

  if (gallery && isProofingGallery(gallery.galleryMode) && gallery.proofingStatus === PROOFING_STATUS_NOT_OPENED) {
    await prisma.gallery.update({
      where: { id: galleryId },
      data: {
        proofingStatus: PROOFING_STATUS_IN_PROGRESS,
        proofingStatusUpdatedAt: new Date()
      }
    });
  }

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
          galleryMode: true,
          proofingStatus: true,
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

  if (favoritesDisabledForGallery(list.gallery)) {
    return {
      ok: false,
      message: "Die Bildauswahl ist für diese Galerie nicht aktiv.",
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

  const proofingSelection = isProofingGallery(list.gallery.galleryMode);
  const submittedAt = new Date();

  await prisma.galleryFavoriteList.update({
    where: { id: list.id },
    data: { submittedAt }
  });

  if (
    isProofingGallery(list.gallery.galleryMode) &&
    ![PROOFING_STATUS_PROCESSING, PROOFING_STATUS_DELIVERED].includes(list.gallery.proofingStatus)
  ) {
    await prisma.gallery.update({
      where: { id: galleryId },
      data: {
        proofingStatus: PROOFING_STATUS_SUBMITTED,
        proofingStatusUpdatedAt: submittedAt
      }
    });
  }

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
    message: proofingSelection ? "Die Auswahl wurde abgeschickt." : "Die Auswahl wurde gespeichert.",
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
          adminId: true,
          galleryMode: true,
          proofingStatus: true
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

  if (favoritesDisabledForGallery(photo.gallery)) {
    return {
      ok: false,
      message: "Die Bildauswahl ist für diese Galerie nicht aktiv."
    };
  }

  const defaultListName =
    isProofingGallery(photo.gallery.galleryMode) && photo.gallery.proofingStatus !== PROOFING_STATUS_DELIVERED
      ? "Auswahl"
      : "Favoriten";
  const existingList = await prisma.galleryFavoriteList.findFirst({
    where: listId
      ? { id: listId, galleryId, email: normalizedEmail }
      : { galleryId, email: normalizedEmail, name: defaultListName },
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
        name: defaultListName
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

  if (isProofingGallery(photo.gallery.galleryMode) && photo.gallery.proofingStatus === PROOFING_STATUS_NOT_OPENED) {
    await prisma.gallery.update({
      where: { id: galleryId },
      data: {
        proofingStatus: PROOFING_STATUS_IN_PROGRESS,
        proofingStatusUpdatedAt: new Date()
      }
    });
  }

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
