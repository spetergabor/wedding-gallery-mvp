import path from "node:path";
import { normalizeSlug } from "@/lib/slug";

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "wedding-gallery";
export const R2_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? "https://cdn.hochzeitsfotografgraz.at";

export function createPhotoObjectKey({
  gallerySlug,
  originalFilename
}: {
  gallerySlug: string;
  originalFilename: string;
}) {
  const extension = path.extname(originalFilename) || ".jpg";
  const baseName = normalizeSlug(path.basename(originalFilename, extension)) || "photo";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}${extension.toLowerCase()}`;

  return `galleries/${gallerySlug}/photos/${uniqueName}`;
}

export function getPublicR2Url(r2Key: string) {
  return `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${r2Key}`;
}

export function getLocalUploadPath(r2Key: string) {
  return path.join(process.cwd(), "public", "uploads", r2Key);
}

export function getLocalUploadUrl(r2Key: string) {
  return `/uploads/${r2Key}`;
}

export function getPhotoPublicUrl(r2Key: string) {
  if (process.env.STORAGE_DRIVER === "r2") {
    return getPublicR2Url(r2Key);
  }

  return getLocalUploadUrl(r2Key);
}

export function localPublicPath(publicUrl: string) {
  if (!publicUrl.startsWith("/uploads/")) {
    return null;
  }

  return path.join(process.cwd(), "public", publicUrl);
}
