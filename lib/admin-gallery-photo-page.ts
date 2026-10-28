import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePhotoFilenameSearch, photoMatchesFilenameSearch } from "@/lib/photo-filename";
import {
  PHOTO_DELIVERY_STAGE_FINAL,
  PHOTO_DELIVERY_STAGE_RAW,
  isProofingGallery
} from "@/lib/proofing";

export const ADMIN_GALLERY_PHOTO_PAGE_SIZE = 120;

export const adminGalleryPhotoSelect = {
  id: true,
  sectionId: true,
  filename: true,
  imageUrl: true,
  thumbnailUrl: true,
  previewUrl: true,
  deliveryStage: true,
  mediaType: true,
  processingStatus: true,
  processingError: true,
  processingRequestedAt: true,
  fileSize: true,
  imageWidth: true,
  imageHeight: true,
  sortOrder: true,
  isClientHidden: true,
  clientHiddenAt: true,
  section: {
    select: {
      id: true,
      title: true,
      slug: true
    }
  }
} satisfies Prisma.PhotoSelect;

export type AdminGalleryPhoto = Prisma.PhotoGetPayload<{
  select: typeof adminGalleryPhotoSelect;
}>;

type PhotoManagerSet = "all" | "raw" | "final" | "selected";

function normalizePhotoManagerSet(value: string | null | undefined): PhotoManagerSet {
  if (value === "raw" || value === "final" || value === "selected") {
    return value;
  }

  return "all";
}

function deliveryStageWhere(galleryMode: string, activeSet: PhotoManagerSet): Prisma.PhotoWhereInput {
  if (!isProofingGallery(galleryMode)) {
    return {};
  }

  if (activeSet === "raw") {
    return { deliveryStage: PHOTO_DELIVERY_STAGE_RAW };
  }

  if (activeSet === "final") {
    return { deliveryStage: PHOTO_DELIVERY_STAGE_FINAL };
  }

  return {};
}

export async function loadAdminGalleryPhotoPage({
  galleryId,
  galleryMode,
  selectedPhotoIds,
  activeSet,
  activeSearch,
  offset = 0,
  limit = ADMIN_GALLERY_PHOTO_PAGE_SIZE
}: {
  galleryId: string;
  galleryMode: string;
  selectedPhotoIds: string[];
  activeSet?: string | null;
  activeSearch?: string | null;
  offset?: number;
  limit?: number;
}) {
  const normalizedSet = normalizePhotoManagerSet(activeSet);
  const normalizedSearch = (activeSearch ?? "").trim();
  const safeOffset = Math.max(0, Math.floor(offset));
  const safeLimit = Math.min(ADMIN_GALLERY_PHOTO_PAGE_SIZE, Math.max(1, Math.floor(limit)));
  const where: Prisma.PhotoWhereInput = {
    galleryId,
    ...deliveryStageWhere(galleryMode, normalizedSet)
  };

  if (isProofingGallery(galleryMode) && normalizedSet === "selected") {
    where.id = { in: selectedPhotoIds };
  }

  if (!normalizedSearch) {
    const [totalCount, photos] = await Promise.all([
      prisma.photo.count({ where }),
      prisma.photo.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip: safeOffset,
        take: safeLimit,
        select: adminGalleryPhotoSelect
      })
    ]);

    return { photos, totalCount };
  }

  // Filename lists can contain extensions, paths and mixed separators. Query the
  // small filename/index projection first, apply the exact shared matcher on the
  // server, then fetch full card data only for the requested 120-item page.
  const candidates = await prisma.photo.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, filename: true }
  });
  const filenameSearch = parsePhotoFilenameSearch(normalizedSearch);
  const matchingIds = candidates
    .filter((photo) => photoMatchesFilenameSearch(photo.filename, filenameSearch))
    .map((photo) => photo.id);
  const pageIds = matchingIds.slice(safeOffset, safeOffset + safeLimit);

  if (pageIds.length === 0) {
    return { photos: [] as AdminGalleryPhoto[], totalCount: matchingIds.length };
  }

  const unorderedPhotos = await prisma.photo.findMany({
    where: { galleryId, id: { in: pageIds } },
    select: adminGalleryPhotoSelect
  });
  const positionById = new Map(pageIds.map((photoId, index) => [photoId, index]));
  const photos = unorderedPhotos.sort(
    (left, right) => (positionById.get(left.id) ?? 0) - (positionById.get(right.id) ?? 0)
  );

  return { photos, totalCount: matchingIds.length };
}
