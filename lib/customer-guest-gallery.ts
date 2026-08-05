import type { Prisma } from "@prisma/client";

export const CUSTOMER_GUEST_PHOTO_PAGE_SIZE = 60;

export type CustomerGuestPhoto = {
  id: string;
  filename: string;
  email: string | null;
  guestName: string | null;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  fileSize: number;
  status: string;
  processingStatus: string;
  customerDeletedAt: string | null;
  createdAt: string;
};

export type CustomerGuestPhotoCursor = {
  createdAt: string;
  id: string;
};

export type CustomerGuestPhotoStatusFilter = "all" | "pending_review" | "visible" | "hidden" | "trash";

export type CustomerGuestPhotoFilters = {
  search: string;
  status: CustomerGuestPhotoStatusFilter;
};

const STATUS_FILTERS = new Set<CustomerGuestPhotoStatusFilter>(["all", "pending_review", "visible", "hidden", "trash"]);

export function normalizeCustomerGuestPhotoFilters(
  input: Partial<CustomerGuestPhotoFilters> | null | undefined
): CustomerGuestPhotoFilters {
  return {
    search: typeof input?.search === "string" ? input.search.trim().slice(0, 120) : "",
    status: STATUS_FILTERS.has(input?.status as CustomerGuestPhotoStatusFilter)
      ? input?.status as CustomerGuestPhotoStatusFilter
      : "all"
  };
}

export function buildCustomerGuestPhotoWhere(
  galleryId: string,
  input: Partial<CustomerGuestPhotoFilters> | null | undefined
): Prisma.GalleryGuestUploadWhereInput {
  const filters = normalizeCustomerGuestPhotoFilters(input);
  const conditions: Prisma.GalleryGuestUploadWhereInput[] = [];

  if (filters.search) {
    conditions.push({
      OR: [
        { filename: { contains: filters.search, mode: "insensitive" } },
        { guestName: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } }
      ]
    });
  }

  if (filters.status === "trash") {
    conditions.push({ customerDeletedAt: { not: null } });
  } else {
    conditions.push({ customerDeletedAt: null });

    if (filters.status === "all") {
      conditions.push({ status: { not: "pending" } });
    } else {
      conditions.push({ status: filters.status });
    }
  }

  return { galleryId, AND: conditions };
}

export function normalizeCustomerGuestPhotoCursor(cursor: CustomerGuestPhotoCursor | null | undefined) {
  if (!cursor?.id || cursor.id.length > 100) {
    return null;
  }

  const createdAt = new Date(cursor.createdAt);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id: cursor.id };
}

export function serializeCustomerGuestPhoto(photo: Omit<CustomerGuestPhoto, "createdAt" | "customerDeletedAt"> & {
  createdAt: Date;
  customerDeletedAt: Date | null;
}) {
  return {
    ...photo,
    createdAt: photo.createdAt.toISOString(),
    customerDeletedAt: photo.customerDeletedAt?.toISOString() ?? null
  } satisfies CustomerGuestPhoto;
}
