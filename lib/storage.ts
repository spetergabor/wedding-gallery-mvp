import path from "node:path";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { normalizeSlug } from "@/lib/slug";

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "wedding-gallery";
export const R2_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? "https://cdn.hochzeitsfotografgraz.at";
export const STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? "local";

let r2Client: S3Client | null = null;
const BYTES_PER_MEGABYTE = 1024 * 1024;

function readPositiveMegabytes(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback * BYTES_PER_MEGABYTE;
  }

  return parsed * BYTES_PER_MEGABYTE;
}

function readPositiveInteger(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }

  return parsed;
}

const MULTIPART_UPLOAD_PART_SIZE = readPositiveMegabytes(process.env.R2_MULTIPART_UPLOAD_PART_SIZE_MB, 64, 5);
const R2_OBJECT_READ_CHUNK_SIZE = readPositiveMegabytes(process.env.R2_OBJECT_READ_CHUNK_SIZE_MB, 64, 1);
const R2_OBJECT_READ_RETRIES = readPositiveInteger(process.env.R2_OBJECT_READ_RETRIES, 4, 1);
const R2_REQUEST_TIMEOUT_MS = readPositiveInteger(process.env.R2_REQUEST_TIMEOUT_MS, 120_000, 5_000);

async function withR2Timeout<T>(label: string, operation: (signal: AbortSignal) => Promise<T>, timeoutMs = R2_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

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

export function createVideoThumbnailObjectKey({
  gallerySlug,
  originalFilename
}: {
  gallerySlug: string;
  originalFilename: string;
}) {
  const extension = path.extname(originalFilename) || ".jpg";
  const baseName = normalizeSlug(path.basename(originalFilename, extension)) || "video-thumbnail";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}${extension.toLowerCase()}`;

  return `galleries/${gallerySlug}/video-thumbnails/${uniqueName}`;
}

export function createGalleryZipObjectKey({
  gallerySlug
}: {
  gallerySlug: string;
}) {
  return `galleries/${gallerySlug}/downloads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${gallerySlug}.zip`;
}

export function createManualGalleryZipObjectKey({
  gallerySlug,
  originalFilename
}: {
  gallerySlug: string;
  originalFilename: string;
}) {
  const baseName = normalizeSlug(path.basename(originalFilename, path.extname(originalFilename))) || gallerySlug;
  return `galleries/${gallerySlug}/downloads/manual/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}.zip`;
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

export function createMiniSessionCoverObjectKey({
  adminId,
  originalFilename
}: {
  adminId: string;
  originalFilename: string;
}) {
  const extension = path.extname(originalFilename) || ".jpg";
  const baseName = normalizeSlug(path.basename(originalFilename, extension)) || "cover";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}${extension.toLowerCase()}`;

  return `mini-sessions/${adminId}/covers/${uniqueName}`;
}

export function createCustomerPortalImageObjectKey({
  customerId,
  originalFilename
}: {
  customerId: string;
  originalFilename: string;
}) {
  const extension = path.extname(originalFilename) || ".jpg";
  const baseName = normalizeSlug(path.basename(originalFilename, extension)) || "inspiration";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}${extension.toLowerCase()}`;

  return `customer-portals/${customerId}/inspiration/${uniqueName}`;
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

export function createInvoiceObjectKey({
  customerId,
  originalFilename
}: {
  customerId: string;
  originalFilename: string;
}) {
  const extension = path.extname(originalFilename) || ".pdf";
  const baseName = normalizeSlug(path.basename(originalFilename, extension)) || "invoice";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}${extension.toLowerCase()}`;

  return `invoices/${customerId}/${uniqueName}`;
}

export function createAlbumReviewSpreadObjectKey({
  customerId,
  reviewId,
  originalFilename
}: {
  customerId: string;
  reviewId: string;
  originalFilename: string;
}) {
  const extension = path.extname(originalFilename) || ".jpg";
  const baseName = normalizeSlug(path.basename(originalFilename, extension)) || "album";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${baseName}${extension.toLowerCase()}`;

  return `album-reviews/${customerId}/${reviewId}/${uniqueName}`;
}

export function createSignedContractObjectKey({
  customerId,
  contractId
}: {
  customerId: string;
  contractId: string;
}) {
  return `contracts/${customerId}/signed/${Date.now()}-${contractId}.pdf`;
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

export async function loadPhotoObjectBuffer({
  r2Key,
  publicUrl
}: {
  r2Key?: string | null;
  publicUrl?: string | null;
}) {
  if (STORAGE_DRIVER === "r2") {
    if (!r2Key) {
      throw new Error("Missing R2 object key for media processing.");
    }

    const response = await getR2Client().send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key
      })
    );

    return responseBodyToBuffer(response.Body);
  }

  if (r2Key) {
    return readFile(getLocalUploadPath(r2Key));
  }

  const localPath = publicUrl ? localPublicPath(publicUrl) : null;

  if (localPath) {
    return readFile(localPath);
  }

  throw new Error("Missing local media path for media processing.");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeStreamChunk(chunk: unknown) {
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }

  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk);
  }

  return Buffer.from(String(chunk));
}

async function responseBodyToBuffer(body: unknown) {
  if (!body) {
    throw new Error("R2 object response did not include a body.");
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }

  if (typeof body === "object" && "transformToByteArray" in body && typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }

  if (typeof body === "object" && Symbol.asyncIterator in body) {
    const chunks: Buffer[] = [];

    for await (const chunk of body as AsyncIterable<unknown>) {
      chunks.push(normalizeStreamChunk(chunk));
    }

    return Buffer.concat(chunks);
  }

  throw new Error("R2 object response body is not readable.");
}

async function loadR2ObjectRange(r2Key: string, start: number, end: number) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= R2_OBJECT_READ_RETRIES; attempt += 1) {
    try {
      return await withR2Timeout(
        `R2 object range read ${start}-${end}`,
        async (signal) => {
          const response = await getR2Client().send(
            new GetObjectCommand({
              Bucket: R2_BUCKET_NAME,
              Key: r2Key,
              Range: `bytes=${start}-${end}`
            }),
            { abortSignal: signal }
          );

          return responseBodyToBuffer(response.Body);
        }
      );
    } catch (error) {
      lastError = error;

      if (attempt < R2_OBJECT_READ_RETRIES) {
        await sleep(Math.min(2000, 250 * 2 ** (attempt - 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`R2 object range could not be read: ${r2Key}`);
}

async function getR2ObjectByteLength(r2Key: string) {
  const response = await getR2Client().send(
    new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key
    })
  );

  return response.ContentLength ?? 0;
}

async function* readR2ObjectInChunks(r2Key: string, byteLength?: number) {
  const totalBytes = byteLength && byteLength > 0 ? byteLength : await getR2ObjectByteLength(r2Key);

  if (totalBytes <= 0) {
    return;
  }

  for (let start = 0; start < totalBytes; start += R2_OBJECT_READ_CHUNK_SIZE) {
    const end = Math.min(start + R2_OBJECT_READ_CHUNK_SIZE - 1, totalBytes - 1);
    yield await loadR2ObjectRange(r2Key, start, end);
  }
}

export function createPhotoReadStream({
  r2Key,
  publicUrl,
  byteLength
}: {
  r2Key: string;
  publicUrl?: string;
  byteLength?: number;
}) {
  if (STORAGE_DRIVER === "r2") {
    if (!r2Key) {
      throw new Error("Missing R2 object key for media download.");
    }

    return Readable.from(readR2ObjectInChunks(r2Key, byteLength));
  }

  if (r2Key) {
    return createReadStream(getLocalUploadPath(r2Key));
  }

  const localPath = publicUrl ? localPublicPath(publicUrl) : null;

  if (localPath) {
    return createReadStream(localPath);
  }

  throw new Error("Missing local media path for download.");
}

export async function savePhotoStream({
  r2Key,
  stream,
  contentType,
  onProgress,
  partSizeBytes
}: {
  r2Key: string;
  stream: NodeJS.ReadableStream;
  contentType?: string;
  onProgress?: (bytesWritten: bigint) => void;
  partSizeBytes?: number;
}) {
  if (STORAGE_DRIVER !== "r2") {
    if (process.env.VERCEL) {
      throw new Error("Local file uploads are disabled on Vercel. Set STORAGE_DRIVER to r2 and redeploy.");
    }

    const filePath = getLocalUploadPath(r2Key);
    let bytesWritten = BigInt(0);
    const byteCounter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytesWritten += BigInt(chunk.length);
        onProgress?.(bytesWritten);
        callback(null, chunk);
      }
    });

    await mkdir(path.dirname(filePath), { recursive: true });
    await pipeline(stream, byteCounter, createWriteStream(filePath));

    return {
      bytesWritten
    };
  }

  const client = getR2Client();
  const uploadPartSize = Math.max(5 * BYTES_PER_MEGABYTE, partSizeBytes || MULTIPART_UPLOAD_PART_SIZE);
  const multipartUpload = await withR2Timeout(
    "R2 multipart upload start",
    (signal) =>
      client.send(
        new CreateMultipartUploadCommand({
          Bucket: R2_BUCKET_NAME,
          Key: r2Key,
          ContentType: contentType || "application/octet-stream"
        }),
        { abortSignal: signal }
      )
  );
  const uploadId = multipartUpload.UploadId;

  if (!uploadId) {
    throw new Error("R2 multipart upload could not be started.");
  }

  let partNumber = 1;
  let bufferedBytes = 0;
  let totalBytes = BigInt(0);
  let buffers: Buffer[] = [];
  const completedParts: Array<{ ETag: string; PartNumber: number }> = [];

  async function uploadPart(body: Buffer) {
    const currentPartNumber = partNumber;
    const uploadedPart = await withR2Timeout(
      `R2 multipart upload part ${currentPartNumber}`,
      (signal) =>
        client.send(
          new UploadPartCommand({
            Bucket: R2_BUCKET_NAME,
            Key: r2Key,
            UploadId: uploadId,
            PartNumber: currentPartNumber,
            Body: body
          }),
          { abortSignal: signal }
        )
    );

    if (!uploadedPart.ETag) {
      throw new Error(`R2 multipart upload part ${currentPartNumber} did not return an ETag.`);
    }

    completedParts.push({
      ETag: uploadedPart.ETag,
      PartNumber: currentPartNumber
    });
    partNumber += 1;
    totalBytes += BigInt(body.length);
    onProgress?.(totalBytes);
  }

  async function uploadBufferedPart(byteLength: number) {
    if (byteLength === 0) {
      return;
    }

    const combined = Buffer.concat(buffers, bufferedBytes);
    const body = combined.subarray(0, byteLength);
    const remaining = combined.subarray(byteLength);

    await uploadPart(body);

    buffers = remaining.length > 0 ? [remaining] : [];
    bufferedBytes = remaining.length;
  }

  try {
    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      buffers.push(buffer);
      bufferedBytes += buffer.length;

      while (bufferedBytes >= uploadPartSize) {
        await uploadBufferedPart(uploadPartSize);
      }
    }

    await uploadBufferedPart(bufferedBytes);

    await withR2Timeout(
      "R2 multipart upload complete",
      (signal) =>
        client.send(
          new CompleteMultipartUploadCommand({
            Bucket: R2_BUCKET_NAME,
            Key: r2Key,
            UploadId: uploadId,
            MultipartUpload: {
              Parts: completedParts
            }
          }),
          { abortSignal: signal }
        )
    );

    return {
      bytesWritten: totalBytes
    };
  } catch (error) {
    await client
      .send(
        new AbortMultipartUploadCommand({
          Bucket: R2_BUCKET_NAME,
          Key: r2Key,
          UploadId: uploadId
        })
      )
      .catch(() => undefined);

    throw error;
  }
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

export async function createMultipartUpload({
  r2Key,
  contentType
}: {
  r2Key: string;
  contentType?: string;
}) {
  if (STORAGE_DRIVER !== "r2") {
    throw new Error("Multipart upload is only available with R2 storage.");
  }

  const multipartUpload = await getR2Client().send(
    new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      ContentType: contentType || "application/octet-stream"
    })
  );

  if (!multipartUpload.UploadId) {
    throw new Error("R2 multipart upload could not be started.");
  }

  return {
    uploadId: multipartUpload.UploadId
  };
}

export async function createPresignedMultipartUploadPartUrl({
  r2Key,
  uploadId,
  partNumber
}: {
  r2Key: string;
  uploadId: string;
  partNumber: number;
}) {
  if (STORAGE_DRIVER !== "r2") {
    throw new Error("Multipart upload is only available with R2 storage.");
  }

  const command = new UploadPartCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
    UploadId: uploadId,
    PartNumber: partNumber
  });

  return getSignedUrl(getR2Client(), command, { expiresIn: 60 * 60 });
}

export async function completeMultipartUpload({
  r2Key,
  uploadId,
  parts
}: {
  r2Key: string;
  uploadId: string;
  parts: Array<{ etag?: string | null; partNumber: number }>;
}) {
  if (STORAGE_DRIVER !== "r2") {
    throw new Error("Multipart upload is only available with R2 storage.");
  }

  const client = getR2Client();
  const normalizedParts = parts
    .filter((part) => Number.isInteger(part.partNumber) && part.partNumber > 0)
    .map((part) => ({
      ETag: part.etag?.trim() || null,
      PartNumber: part.partNumber
    }))
    .sort((left, right) => left.PartNumber - right.PartNumber);

  if (normalizedParts.length === 0) {
    throw new Error("No uploaded parts were provided.");
  }

  let completedParts = normalizedParts;

  if (completedParts.some((part) => !part.ETag)) {
    const listedParts: Array<{ ETag: string; PartNumber: number }> = [];
    let partNumberMarker: string | undefined;

    do {
      const listed = await client.send(
        new ListPartsCommand({
          Bucket: R2_BUCKET_NAME,
          Key: r2Key,
          UploadId: uploadId,
          PartNumberMarker: partNumberMarker
        })
      );

      for (const part of listed.Parts ?? []) {
        if (part.ETag && part.PartNumber) {
          listedParts.push({
            ETag: part.ETag,
            PartNumber: part.PartNumber
          });
        }
      }

      partNumberMarker = listed.NextPartNumberMarker;
    } while (partNumberMarker);

    const expectedPartNumbers = new Set(normalizedParts.map((part) => part.PartNumber));
    completedParts = listedParts
      .filter((part) => expectedPartNumbers.has(part.PartNumber))
      .sort((left, right) => left.PartNumber - right.PartNumber);
  }

  if (completedParts.length !== normalizedParts.length || completedParts.some((part) => !part.ETag)) {
    throw new Error("R2 multipart upload parts could not be verified.");
  }

  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: completedParts.map((part) => ({
          ETag: part.ETag ?? undefined,
          PartNumber: part.PartNumber
        }))
      }
    })
  );
}

export async function abortMultipartUpload({
  r2Key,
  uploadId
}: {
  r2Key: string;
  uploadId: string;
}) {
  if (STORAGE_DRIVER !== "r2") {
    return;
  }

  await getR2Client()
    .send(
      new AbortMultipartUploadCommand({
        Bucket: R2_BUCKET_NAME,
        Key: r2Key,
        UploadId: uploadId
      })
    )
    .catch(() => undefined);
}

export async function createPresignedPhotoDownloadUrl({
  r2Key,
  filename,
  expiresIn = 60 * 60
}: {
  r2Key: string;
  filename?: string;
  expiresIn?: number;
}) {
  if (STORAGE_DRIVER !== "r2") {
    return getPhotoPublicUrl(r2Key);
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
    ResponseContentDisposition: filename ? `attachment; filename="${filename.replace(/"/g, "")}"` : undefined
  });

  return getSignedUrl(getR2Client(), command, { expiresIn });
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
