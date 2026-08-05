import type { Prisma } from "@prisma/client";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { workDateTimeInAppTimeZone } from "@/lib/work-date";

export const ADMIN_GUEST_PHOTO_PAGE_SIZE = 60;

export type GuestGalleryAdminPhoto = {
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
  createdAt: string;
};

export type GuestGalleryAdminPhotoCursor = {
  createdAt: string;
  id: string;
};

export type GuestGalleryAdminStatusFilter =
  | "all"
  | "pending_review"
  | "visible"
  | "hidden"
  | "uploading"
  | "processing"
  | "failed";

export type GuestGalleryAdminDateFilter = "all" | "today" | "7d" | "30d";

export type GuestGalleryAdminPhotoFilters = {
  search: string;
  status: GuestGalleryAdminStatusFilter;
  date: GuestGalleryAdminDateFilter;
};

export type GuestGalleryAdminSelection =
  | { mode: "ids"; ids: string[] }
  | { mode: "filter"; filters: GuestGalleryAdminPhotoFilters; excludedIds: string[] };

const STATUS_FILTERS = new Set<GuestGalleryAdminStatusFilter>([
  "all",
  "pending_review",
  "visible",
  "hidden",
  "uploading",
  "processing",
  "failed"
]);
const DATE_FILTERS = new Set<GuestGalleryAdminDateFilter>(["all", "today", "7d", "30d"]);

export function normalizeGuestGalleryAdminFilters(
  filters: Partial<GuestGalleryAdminPhotoFilters> | null | undefined
): GuestGalleryAdminPhotoFilters {
  const status = STATUS_FILTERS.has(filters?.status as GuestGalleryAdminStatusFilter)
    ? filters?.status as GuestGalleryAdminStatusFilter
    : "all";
  const date = DATE_FILTERS.has(filters?.date as GuestGalleryAdminDateFilter)
    ? filters?.date as GuestGalleryAdminDateFilter
    : "all";

  return {
    search: typeof filters?.search === "string" ? filters.search.trim().slice(0, 120) : "",
    status,
    date
  };
}

function startOfToday(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const calendarDate = new Date(Date.UTC(value("year"), value("month") - 1, value("day"), 12));
  return workDateTimeInAppTimeZone(calendarDate, null, "start");
}

export function buildGuestGalleryAdminPhotoWhere(
  galleryId: string,
  input: Partial<GuestGalleryAdminPhotoFilters> | null | undefined
): Prisma.GalleryGuestUploadWhereInput {
  const filters = normalizeGuestGalleryAdminFilters(input);
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

  if (filters.status === "uploading") {
    conditions.push({ OR: [{ status: "pending" }, { processingStatus: "uploading" }] });
  } else if (filters.status === "processing") {
    conditions.push({ processingStatus: { in: ["pending", "processing"] } });
  } else if (filters.status === "failed") {
    conditions.push({ processingStatus: "failed" });
  } else if (filters.status !== "all") {
    conditions.push({ status: filters.status });
  }

  if (filters.date === "today") {
    conditions.push({ createdAt: { gte: startOfToday(new Date()) } });
  } else if (filters.date === "7d" || filters.date === "30d") {
    const days = filters.date === "7d" ? 7 : 30;
    conditions.push({ createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } });
  }

  return {
    galleryId,
    ...(conditions.length > 0 ? { AND: conditions } : {})
  };
}

export function normalizeGuestGalleryAdminCursor(
  cursor: GuestGalleryAdminPhotoCursor | null | undefined
) {
  if (!cursor?.id || cursor.id.length > 100) {
    return null;
  }

  const createdAt = new Date(cursor.createdAt);
  return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id: cursor.id };
}

export function serializeGuestGalleryAdminPhoto(photo: Omit<GuestGalleryAdminPhoto, "createdAt"> & { createdAt: Date }) {
  return {
    ...photo,
    createdAt: photo.createdAt.toISOString()
  } satisfies GuestGalleryAdminPhoto;
}
