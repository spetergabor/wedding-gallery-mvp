"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { adminOwnedWhere, favoriteListAccessWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import {
  adminFavoriteDownloadScope,
  adminFavoriteListIdFromScope,
  ensureDownloadPackageAccessToken,
  isAdminFavoriteDownloadScope
} from "@/lib/download-packages";
import {
  createZipPartRanges,
  enqueueGalleryZipJob,
  galleryZipFileName,
  kickGalleryZipJobs
} from "@/lib/jobs";
import { prisma } from "@/lib/prisma";

type DownloadPackageSummary = {
  id: string;
  status: string;
  downloadUrl: string | null;
  errorMessage: string | null;
  groupId: string | null;
  partIndex: number;
  partCount: number;
  processedCount: number;
  photoCount: number;
};

type FavoriteZipLink = {
  id: string;
  downloadUrl: string;
  filename: string;
  partIndex: number;
  partCount: number;
};

type FavoriteZipState = {
  ok: boolean;
  message: string;
  status: string;
  packageId: string | null;
  processedCount: number;
  photoCount: number;
  packages: FavoriteZipLink[];
};

function groupedPackages(packages: DownloadPackageSummary[]) {
  const groups = new Map<string, DownloadPackageSummary[]>();

  for (const downloadPackage of packages) {
    const key = downloadPackage.groupId ?? downloadPackage.id;
    groups.set(key, [...(groups.get(key) ?? []), downloadPackage]);
  }

  return Array.from(groups.values()).map((group) => group.sort((a, b) => a.partIndex - b.partIndex));
}

function isCompletePackageSet(packages: DownloadPackageSummary[]) {
  if (packages.length === 0) {
    return false;
  }

  const expectedPartCount = Math.max(...packages.map((downloadPackage) => downloadPackage.partCount), packages.length, 1);
  const completedParts = new Set(
    packages
      .filter((downloadPackage) => downloadPackage.status === "completed" && downloadPackage.downloadUrl)
      .map((downloadPackage) => downloadPackage.partIndex)
  );

  return packages.length === expectedPartCount && Array.from({ length: expectedPartCount }, (_, index) => completedParts.has(index)).every(Boolean);
}

function favoriteZipTitle(galleryTitle: string, listName: string) {
  return `${galleryTitle}-${listName}`;
}

async function downloadLinks(packages: DownloadPackageSummary[], title: string): Promise<FavoriteZipLink[]> {
  return Promise.all(
    [...packages]
      .sort((a, b) => a.partIndex - b.partIndex)
      .map(async (downloadPackage) => {
        const { token } = await ensureDownloadPackageAccessToken(downloadPackage.id);

        return {
          id: downloadPackage.id,
          downloadUrl: `/download/${token}`,
          filename: galleryZipFileName(title, downloadPackage.partIndex, downloadPackage.partCount, "original"),
          partIndex: downloadPackage.partIndex,
          partCount: downloadPackage.partCount
        };
      })
  );
}

function progressState(packages: DownloadPackageSummary[], photoCount: number) {
  const processedCount = Math.min(
    photoCount,
    packages.reduce((total, downloadPackage) => total + downloadPackage.processedCount, 0)
  );

  return { processedCount, photoCount };
}

function failedState(message: string, photoCount = 0): FavoriteZipState {
  return {
    ok: false,
    message,
    status: "failed",
    packageId: null,
    processedCount: 0,
    photoCount,
    packages: []
  };
}

export async function requestAdminFavoriteListZipAction(listId: string): Promise<FavoriteZipState> {
  const admin = await requireAdmin();
  const normalizedListId = listId.trim();

  if (!normalizedListId) {
    return failedState("A kedvenclista nem található.");
  }

  const list = await prisma.galleryFavoriteList.findFirst({
    where: favoriteListAccessWhere(admin, normalizedListId),
    select: {
      id: true,
      name: true,
      updatedAt: true,
      gallery: {
        select: {
          id: true,
          title: true
        }
      },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          photo: {
            select: {
              id: true,
              fileSize: true,
              mediaType: true
            }
          }
        }
      }
    }
  });

  if (!list) {
    return failedState("A kedvenclista nem található.");
  }

  const favoritePhotos = list.items.map((item) => item.photo);

  if (favoritePhotos.length === 0) {
    return failedState("A listában még nincs letölthető kép.");
  }

  const scope = adminFavoriteDownloadScope(list.id);
  const packageSelect = {
    id: true,
    status: true,
    downloadUrl: true,
    errorMessage: true,
    groupId: true,
    partIndex: true,
    partCount: true,
    processedCount: true,
    photoCount: true
  } as const;
  const completedPackages = await prisma.galleryDownloadPackage.findMany({
    where: {
      galleryId: list.gallery.id,
      scope,
      status: "completed",
      photoCount: favoritePhotos.length,
      downloadUrl: { not: null },
      r2Key: { not: null },
      generatedAt: { gte: list.updatedAt }
    },
    orderBy: [{ createdAt: "desc" }, { partIndex: "asc" }],
    select: packageSelect
  });
  const completedGroup = groupedPackages(completedPackages).find(isCompletePackageSet);
  const title = favoriteZipTitle(list.gallery.title, list.name);

  if (completedGroup) {
    return {
      ok: true,
      message: "A kedvenc képek ZIP-je letölthető.",
      status: "completed",
      packageId: completedGroup[0]?.id ?? null,
      ...progressState(completedGroup, favoritePhotos.length),
      packages: await downloadLinks(completedGroup, title)
    };
  }

  const pendingPackages = await prisma.galleryDownloadPackage.findMany({
    where: {
      galleryId: list.gallery.id,
      scope,
      status: { in: ["pending", "processing"] },
      photoCount: favoritePhotos.length,
      createdAt: { gte: list.updatedAt }
    },
    orderBy: [{ createdAt: "desc" }, { partIndex: "asc" }],
    select: packageSelect
  });
  let activePackages = groupedPackages(pendingPackages)[0] ?? null;
  let payloads: Array<{ galleryId: string; packageId: string; jobId?: string }> = [];

  if (activePackages) {
    payloads = await Promise.all(
      activePackages.map(async (downloadPackage) => ({
        galleryId: list.gallery.id,
        packageId: downloadPackage.id,
        jobId: (await enqueueGalleryZipJob({ galleryId: list.gallery.id, packageId: downloadPackage.id })).id
      }))
    );
  } else {
    const ranges = createZipPartRanges(favoritePhotos, "original");
    const partCount = ranges.length;
    const groupId = partCount > 1 ? randomUUID() : null;
    activePackages = await prisma.$transaction(
      ranges.map((range, partIndex) =>
        prisma.galleryDownloadPackage.create({
          data: {
            galleryId: list.gallery.id,
            scope,
            status: "pending",
            photoCount: favoritePhotos.length,
            partIndex,
            partCount,
            photoOffset: range.offset,
            photoLimit: range.limit,
            groupId
          },
          select: packageSelect
        })
      )
    );
    payloads = await Promise.all(
      activePackages.map(async (downloadPackage) => ({
        galleryId: list.gallery.id,
        packageId: downloadPackage.id,
        jobId: (await enqueueGalleryZipJob({ galleryId: list.gallery.id, packageId: downloadPackage.id })).id
      }))
    );
  }

  after(async () => {
    await kickGalleryZipJobs(payloads);
  });

  return {
    ok: true,
    message: "A kedvenc képek ZIP-je a háttérben készül.",
    status: activePackages.some((downloadPackage) => downloadPackage.status === "processing") ? "processing" : "pending",
    packageId: activePackages[0]?.id ?? null,
    ...progressState(activePackages, favoritePhotos.length),
    packages: []
  };
}

export async function getAdminFavoriteListZipStateAction(packageId: string): Promise<FavoriteZipState> {
  const admin = await requireAdmin();
  const normalizedPackageId = packageId.trim();

  if (!normalizedPackageId) {
    return failedState("A ZIP-csomag nem található.");
  }

  const rootPackage = await prisma.galleryDownloadPackage.findFirst({
    where: {
      id: normalizedPackageId,
      gallery: adminOwnedWhere(admin)
    },
    select: {
      id: true,
      scope: true,
      groupId: true,
      galleryId: true,
      gallery: {
        select: { title: true }
      }
    }
  });

  if (!rootPackage || !isAdminFavoriteDownloadScope(rootPackage.scope)) {
    return failedState("A ZIP-csomag nem található.");
  }

  const listId = adminFavoriteListIdFromScope(rootPackage.scope);

  if (!listId) {
    return failedState("A kedvenclista nem található.");
  }
  const list = await prisma.galleryFavoriteList.findFirst({
    where: favoriteListAccessWhere(admin, listId),
    select: {
      name: true,
      items: { select: { id: true } }
    }
  });

  if (!list) {
    return failedState("A kedvenclista már nem található.");
  }

  const packages = await prisma.galleryDownloadPackage.findMany({
    where: rootPackage.groupId
      ? {
          groupId: rootPackage.groupId,
          galleryId: rootPackage.galleryId,
          scope: rootPackage.scope
        }
      : { id: rootPackage.id },
    orderBy: { partIndex: "asc" },
    select: {
      id: true,
      status: true,
      downloadUrl: true,
      errorMessage: true,
      groupId: true,
      partIndex: true,
      partCount: true,
      processedCount: true,
      photoCount: true
    }
  });
  const photoCount = packages[0]?.photoCount ?? list.items.length;
  const failedPackage = packages.find((downloadPackage) => ["failed", "stale", "expired"].includes(downloadPackage.status));

  if (failedPackage) {
    return failedState(failedPackage.errorMessage || "A ZIP készítése nem sikerült.", photoCount);
  }

  if (isCompletePackageSet(packages)) {
    return {
      ok: true,
      message: "A kedvenc képek ZIP-je letölthető.",
      status: "completed",
      packageId: rootPackage.id,
      ...progressState(packages, photoCount),
      packages: await downloadLinks(packages, favoriteZipTitle(rootPackage.gallery.title, list.name))
    };
  }

  const status = packages.some((downloadPackage) => downloadPackage.status === "processing") ? "processing" : "pending";

  return {
    ok: true,
    message: status === "processing" ? "A ZIP éppen készül." : "A ZIP feldolgozásra vár.",
    status,
    packageId: rootPackage.id,
    ...progressState(packages, photoCount),
    packages: []
  };
}
