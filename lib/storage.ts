import path from "node:path";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { normalizeSlug } from "@/lib/slug";

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "wedding-gallery";
export const R2_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? "https://cdn.hochzeitsfotografgraz.at";
export const STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? "local";

let r2Client: S3Client | null = null;

function r2Endpoint() {
  if (process.env.R2_ENDPOINT) {
    const endpoint = process.env.R2_ENDPOINT.trim();

    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      return endpoint;
    }

    return `https://${endpoint}.r2.cloudflarestorage.com`;
  }

  if (process.env.CLOUDFLARE_ACCOUNT_ID) {
    return `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }

  return null;
}

function getR2Client() {
  if (r2Client) {
    return r2Client;
  }

  const endpoint = r2Endpoint();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing Cloudflare R2 configuration. Check R2_ENDPOINT, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.");
  }

  r2Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  return r2Client;
}

export function isR2StorageEnabled() {
  return STORAGE_DRIVER === "r2";
}

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

export function createPhotoVariantObjectKey({
  gallerySlug,
  originalFilename,
  variant
}: {
  gallerySlug: string;
  originalFilename: string;
  variant: "thumbnail" | "preview";
}) {
  const extension = ".jpg";
  const baseName = normalizeSlug(path.basename(originalFilename, path.extname(originalFilename))) || "photo";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}${extension}`;
  const folder = variant === "thumbnail" ? "thumbs" : "previews";

  return `galleries/${gallerySlug}/${folder}/${uniqueName}`;
}

export function createGalleryZipObjectKey({
  gallerySlug
}: {
  gallerySlug: string;
}) {
  return `galleries/${gallerySlug}/downloads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${gallerySlug}.zip`;
}

export function createBrandAssetObjectKey({
  originalFilename
}: {
  originalFilename: string;
}) {
  const extension = path.extname(originalFilename) || ".png";
  const baseName = normalizeSlug(path.basename(originalFilename, extension)) || "brand";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}${extension.toLowerCase()}`;

  return `brand/${uniqueName}`;
}

export function createContractObjectKey({
  customerId,
  originalFilename
}: {
  customerId: string;
  originalFilename: string;
}) {
  const extension = path.extname(originalFilename) || ".pdf";
  const baseName = normalizeSlug(path.basename(originalFilename, extension)) || "contract";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}${extension.toLowerCase()}`;

  return `contracts/${customerId}/${uniqueName}`;
}

export function getPublicR2Url(r2Key: string) {
  return `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${r2Key}`;
}

export function getR2KeyFromPublicUrl(publicUrl: string | null | undefined) {
  if (!publicUrl) {
    return null;
  }

  const baseUrl = R2_PUBLIC_BASE_URL.replace(/\/$/, "");

  if (!publicUrl.startsWith(`${baseUrl}/`)) {
    return null;
  }

  return publicUrl.slice(baseUrl.length + 1);
}

export function getLocalUploadPath(r2Key: string) {
  return path.join(process.cwd(), "public", "uploads", r2Key);
}

export function getLocalUploadUrl(r2Key: string) {
  return `/uploads/${r2Key}`;
}

export function getPhotoPublicUrl(r2Key: string) {
  if (STORAGE_DRIVER === "r2") {
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

export async function savePhotoObject({
  r2Key,
  bytes,
  contentType
}: {
  r2Key: string;
  bytes: Buffer;
  contentType?: string;
}) {
  if (STORAGE_DRIVER === "r2") {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        Body: bytes,
        ContentType: contentType || "application/octet-stream"
      })
    );

    return;
  }

  if (process.env.VERCEL) {
    throw new Error("Local file uploads are disabled on Vercel. Set STORAGE_DRIVER to r2 and redeploy.");
  }

  const filePath = getLocalUploadPath(r2Key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}

export async function createPresignedPhotoUploadUrl({
  r2Key,
  contentType
}: {
  r2Key: string;
  contentType?: string;
}) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
    ContentType: contentType || "application/octet-stream"
  });

  return getSignedUrl(getR2Client(), command, { expiresIn: 60 * 10 });
}

export async function deletePhotoObject(r2Key: string) {
  if (!r2Key) {
    return;
  }

  if (STORAGE_DRIVER === "r2") {
    await getR2Client()
      .send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: r2Key
        })
      )
      .catch(() => undefined);

    return;
  }

  await unlink(getLocalUploadPath(r2Key)).catch(() => undefined);
}

export async function deleteGalleryObjects(gallerySlug: string, r2Keys: Array<string | null | undefined>) {
  const uniqueKeys = [...new Set(r2Keys.filter((r2Key): r2Key is string => Boolean(r2Key)))];

  await Promise.all(uniqueKeys.map((r2Key) => deletePhotoObject(r2Key)));

  if (STORAGE_DRIVER !== "r2") {
    await Promise.all([
      rm(path.join(process.cwd(), "public", "uploads", "galleries", gallerySlug), {
        recursive: true,
        force: true
      }),
      rm(path.join(process.cwd(), "public", "uploads", gallerySlug), {
        recursive: true,
        force: true
      })
    ]);
  }
}
