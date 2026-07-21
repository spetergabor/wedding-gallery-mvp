import {
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  GetBucketCorsCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutBucketCorsCommand,
  S3Client
} from "@aws-sdk/client-s3";
import type { CORSRule } from "@aws-sdk/client-s3";
import { prisma } from "@/lib/prisma";

export type R2MultipartUploadAudit = {
  key: string;
  uploadId: string;
  initiated: Date | null;
  partCount: number;
  partBytes: number;
};

type R2ObjectSummary = {
  count: number;
  bytes: number;
};

type R2ObjectAudit = {
  total: R2ObjectSummary;
  topPrefixes: Array<{ key: string; count: number; bytes: number }>;
  largestObjects: Array<{ key: string; bytes: number }>;
};

export type R2StorageAudit = {
  bucket: string;
  endpoint: string;
  configured: boolean;
  missingConfig: string[];
  multipartUploads: R2MultipartUploadAudit[];
  objects: R2ObjectAudit | null;
  database: {
    photoCount: number;
    photoBytes: number;
    downloadPackageCount: number;
    downloadPackageBytes: number;
    staleDownloadPackageCount: number;
    staleDownloadPackageBytes: number;
  };
};

const R2_MULTIPART_CLEANUP_JOB_TYPE = "r2-multipart-cleanup";
const DEFAULT_R2_MULTIPART_CLEANUP_MIN_AGE_HOURS = 24;
const DEFAULT_R2_DOWNLOAD_PACKAGE_CLEANUP_MAX_IDLE_DAYS = 7;

export type R2MultipartCleanupResult = {
  bucket: string;
  minAgeHours: number;
  cutoff: Date;
  scannedUploads: number;
  abortedUploads: number;
  skippedRecentUploads: number;
  skippedUnknownAgeUploads: number;
  aborted: Array<{ key: string; uploadId: string; initiated: Date | null }>;
};

export type R2DownloadPackageCleanupResult = {
  bucket: string;
  maxIdleDays: number;
  cutoff: Date;
  scannedPackages: number;
  deletedPackages: number;
  deletedBytes: number;
  deleted: Array<{
    id: string;
    galleryId: string;
    r2Key: string;
    fileSize: number;
    generatedAt: Date | null;
    lastDownloadedAt: Date | null;
  }>;
};

export type R2FullCleanupResult = {
  multipart: R2MultipartCleanupResult;
  downloadPackages: R2DownloadPackageCleanupResult;
};

export type R2CleanupRunSummary = {
  status: string;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  minAgeHours: number | null;
  scannedUploads: number | null;
  abortedUploads: number | null;
  skippedRecentUploads: number | null;
  skippedUnknownAgeUploads: number | null;
};

export type R2CorsUpdateResult = {
  bucket: string;
  ruleCount: number;
  origins: string[];
  methods: string[];
  exposeHeaders: string[];
};

function r2Endpoint() {
  const explicit = process.env.R2_ENDPOINT?.trim();

  if (explicit) {
    if (explicit.startsWith("http://") || explicit.startsWith("https://")) {
      return explicit;
    }

    return `https://${explicit.replace(/^\.+|\.+$/g, "")}.r2.cloudflarestorage.com`;
  }

  if (process.env.CLOUDFLARE_ACCOUNT_ID) {
    return `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }

  return "";
}

function r2Config() {
  const endpoint = r2Endpoint();
  const bucket = process.env.R2_BUCKET_NAME?.trim() || "wedding-gallery";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || "";
  const missingConfig = [
    endpoint ? "" : "R2_ENDPOINT vagy CLOUDFLARE_ACCOUNT_ID",
    accessKeyId ? "" : "R2_ACCESS_KEY_ID",
    secretAccessKey ? "" : "R2_SECRET_ACCESS_KEY"
  ].filter(Boolean);

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    missingConfig
  };
}

function r2Client(config = r2Config()) {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

function uniqueList(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function appOrigin() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function r2ErrorStatusCode(error: unknown) {
  if (!error || typeof error !== "object" || !("$metadata" in error)) {
    return undefined;
  }

  return (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
}

export async function updateR2BrowserUploadCors(): Promise<R2CorsUpdateResult> {
  const config = r2Config();

  if (config.missingConfig.length > 0) {
    throw new Error(`Missing R2 configuration: ${config.missingConfig.join(", ")}`);
  }

  const client = r2Client(config);
  const origins = uniqueList([
    appOrigin(),
    "https://spetly.app",
    "https://www.spetly.app",
    "https://*.spetly.app",
    "https://gallery.hochzeitsfotografgraz.at",
    "https://wedding-gallery-mvp.vercel.app",
    "https://wedding-gallery-mvp-spetergabor-s-projects.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]);
  const methods = ["GET", "HEAD", "PUT", "POST"];
  const exposeHeaders = ["ETag"];
  const desiredRule = {
    ID: "spetly-browser-uploads",
    AllowedHeaders: ["*"],
    AllowedMethods: methods,
    AllowedOrigins: origins,
    ExposeHeaders: exposeHeaders,
    MaxAgeSeconds: 3600
  };

  let existingRules: CORSRule[] = [];

  try {
    const current = await client.send(new GetBucketCorsCommand({ Bucket: config.bucket }));
    existingRules = current.CORSRules ?? [];
  } catch (error) {
    if (error instanceof Error && error.name !== "NoSuchCORSConfiguration") {
      const statusCode = r2ErrorStatusCode(error);

      if (statusCode !== 404) {
        throw error;
      }
    }
  }

  const managedOrigins = new Set(["https://spetly.app", "https://*.spetly.app", "https://gallery.hochzeitsfotografgraz.at"]);
  const preservedRules = existingRules.filter((rule) => {
    if (rule.ID === desiredRule.ID) {
      return false;
    }

    return !(rule.AllowedOrigins ?? []).some((origin) => managedOrigins.has(origin));
  });

  await client.send(
    new PutBucketCorsCommand({
      Bucket: config.bucket,
      CORSConfiguration: {
        CORSRules: [desiredRule, ...preservedRules]
      }
    })
  );

  const updated = await client.send(new GetBucketCorsCommand({ Bucket: config.bucket }));

  return {
    bucket: config.bucket,
    ruleCount: updated.CORSRules?.length ?? 0,
    origins,
    methods,
    exposeHeaders
  };
}

function addSummary(map: Map<string, R2ObjectSummary>, key: string, bytes: number) {
  const current = map.get(key) ?? { count: 0, bytes: 0 };
  current.count += 1;
  current.bytes += bytes;
  map.set(key, current);
}

function summaryRows(map: Map<string, R2ObjectSummary>, limit: number) {
  return [...map.entries()]
    .map(([key, value]) => ({ key, count: value.count, bytes: value.bytes }))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, limit);
}

function readPositiveInteger(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }

  return parsed;
}

async function listMultipartUploads(client: S3Client, bucket: string, { includeParts = false }: { includeParts?: boolean } = {}) {
  const uploads: R2MultipartUploadAudit[] = [];
  let KeyMarker: string | undefined;
  let UploadIdMarker: string | undefined;

  do {
    const response = await client.send(
      new ListMultipartUploadsCommand({
        Bucket: bucket,
        KeyMarker,
        UploadIdMarker
      })
    );

    for (const upload of response.Uploads ?? []) {
      if (!upload.Key || !upload.UploadId) {
        continue;
      }

      const parts = includeParts
        ? await listMultipartUploadParts(client, bucket, upload.Key, upload.UploadId)
        : { count: 0, bytes: 0 };

      uploads.push({
        key: upload.Key,
        uploadId: upload.UploadId,
        initiated: upload.Initiated ?? null,
        partCount: parts.count,
        partBytes: parts.bytes
      });
    }

    KeyMarker = response.NextKeyMarker;
    UploadIdMarker = response.NextUploadIdMarker;
  } while (KeyMarker || UploadIdMarker);

  return uploads.sort((left, right) => {
    const sizeSort = right.partBytes - left.partBytes;

    if (sizeSort !== 0) {
      return sizeSort;
    }

    return (left.initiated?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right.initiated?.getTime() ?? Number.MAX_SAFE_INTEGER);
  });
}

async function listMultipartUploadParts(client: S3Client, bucket: string, key: string, uploadId: string) {
  let PartNumberMarker: string | undefined;
  let count = 0;
  let bytes = 0;

  do {
    const response = await client.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumberMarker
      })
    );

    for (const part of response.Parts ?? []) {
      count += 1;
      bytes += Number(part.Size ?? 0);
    }

    PartNumberMarker = response.NextPartNumberMarker;
  } while (PartNumberMarker);

  return { count, bytes };
}

async function listObjectAudit(client: S3Client, bucket: string): Promise<R2ObjectAudit> {
  const topPrefixes = new Map<string, R2ObjectSummary>();
  const largestObjects: Array<{ key: string; bytes: number }> = [];
  let ContinuationToken: string | undefined;
  let totalCount = 0;
  let totalBytes = 0;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken
      })
    );

    for (const object of response.Contents ?? []) {
      const key = object.Key ?? "";
      const bytes = Number(object.Size ?? 0);
      totalCount += 1;
      totalBytes += bytes;
      addSummary(topPrefixes, key.split("/")[0] || "(root)", bytes);
      largestObjects.push({ key, bytes });
    }

    ContinuationToken = response.NextContinuationToken;
  } while (ContinuationToken);

  return {
    total: {
      count: totalCount,
      bytes: totalBytes
    },
    topPrefixes: summaryRows(topPrefixes, 12),
    largestObjects: largestObjects.sort((left, right) => right.bytes - left.bytes).slice(0, 12)
  };
}

async function getDatabaseAudit() {
  const [photos, packages, stalePackages] = await Promise.all([
    prisma.photo.aggregate({
      _count: { _all: true },
      _sum: { fileSize: true }
    }),
    prisma.galleryDownloadPackage.aggregate({
      where: { r2Key: { not: null } },
      _count: { _all: true },
      _sum: { fileSize: true }
    }),
    prisma.galleryDownloadPackage.aggregate({
      where: { status: "stale", r2Key: { not: null } },
      _count: { _all: true },
      _sum: { fileSize: true }
    })
  ]);

  return {
    photoCount: photos._count._all,
    photoBytes: Number(photos._sum.fileSize ?? 0),
    downloadPackageCount: packages._count._all,
    downloadPackageBytes: Number(packages._sum.fileSize ?? 0),
    staleDownloadPackageCount: stalePackages._count._all,
    staleDownloadPackageBytes: Number(stalePackages._sum.fileSize ?? 0)
  };
}

export async function getR2StorageAudit({ includeObjects = false }: { includeObjects?: boolean } = {}): Promise<R2StorageAudit> {
  const config = r2Config();
  const database = await getDatabaseAudit();

  if (config.missingConfig.length > 0) {
    return {
      bucket: config.bucket,
      endpoint: config.endpoint,
      configured: false,
      missingConfig: config.missingConfig,
      multipartUploads: [],
      objects: null,
      database
    };
  }

  const client = r2Client(config);
  const [multipartUploads, objects] = await Promise.all([
    listMultipartUploads(client, config.bucket),
    includeObjects ? listObjectAudit(client, config.bucket) : Promise.resolve(null)
  ]);

  return {
    bucket: config.bucket,
    endpoint: config.endpoint,
    configured: true,
    missingConfig: [],
    multipartUploads,
    objects,
    database
  };
}

export async function abortR2MultipartUpload({ key, uploadId }: { key: string; uploadId: string }) {
  const config = r2Config();

  if (config.missingConfig.length > 0) {
    throw new Error(`Missing R2 configuration: ${config.missingConfig.join(", ")}`);
  }

  const client = r2Client(config);

  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      UploadId: uploadId
    })
  );
}

export async function abortAllR2MultipartUploads() {
  const config = r2Config();

  if (config.missingConfig.length > 0) {
    throw new Error(`Missing R2 configuration: ${config.missingConfig.join(", ")}`);
  }

  const client = r2Client(config);
  const uploads = await listMultipartUploads(client, config.bucket);

  for (const upload of uploads) {
    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: config.bucket,
        Key: upload.key,
        UploadId: upload.uploadId
      })
    );
  }

  return uploads.length;
}

export async function abortStaleR2MultipartUploads({ minAgeHours }: { minAgeHours?: number } = {}): Promise<R2MultipartCleanupResult> {
  const config = r2Config();

  if (config.missingConfig.length > 0) {
    throw new Error(`Missing R2 configuration: ${config.missingConfig.join(", ")}`);
  }

  const effectiveMinAgeHours =
    minAgeHours ?? readPositiveInteger(process.env.R2_MULTIPART_CLEANUP_MIN_AGE_HOURS, DEFAULT_R2_MULTIPART_CLEANUP_MIN_AGE_HOURS, 1);
  const cutoff = new Date(Date.now() - effectiveMinAgeHours * 60 * 60 * 1000);
  const client = r2Client(config);
  const uploads = await listMultipartUploads(client, config.bucket);
  const result: R2MultipartCleanupResult = {
    bucket: config.bucket,
    minAgeHours: effectiveMinAgeHours,
    cutoff,
    scannedUploads: uploads.length,
    abortedUploads: 0,
    skippedRecentUploads: 0,
    skippedUnknownAgeUploads: 0,
    aborted: []
  };

  for (const upload of uploads) {
    if (!upload.initiated) {
      result.skippedUnknownAgeUploads += 1;
      continue;
    }

    if (upload.initiated.getTime() > cutoff.getTime()) {
      result.skippedRecentUploads += 1;
      continue;
    }

    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: config.bucket,
        Key: upload.key,
        UploadId: upload.uploadId
      })
    );

    result.abortedUploads += 1;
    result.aborted.push({
      key: upload.key,
      uploadId: upload.uploadId,
      initiated: upload.initiated
    });
  }

  return result;
}

function cleanupResultToJson(result: R2MultipartCleanupResult) {
  return {
    bucket: result.bucket,
    minAgeHours: result.minAgeHours,
    cutoff: result.cutoff.toISOString(),
    scannedUploads: result.scannedUploads,
    abortedUploads: result.abortedUploads,
    skippedRecentUploads: result.skippedRecentUploads,
    skippedUnknownAgeUploads: result.skippedUnknownAgeUploads,
    aborted: result.aborted.map((upload) => ({
      key: upload.key,
      uploadId: upload.uploadId,
      initiated: upload.initiated?.toISOString() ?? null
    }))
  };
}

function downloadPackageCleanupResultToJson(result: R2DownloadPackageCleanupResult) {
  return {
    bucket: result.bucket,
    maxIdleDays: result.maxIdleDays,
    cutoff: result.cutoff.toISOString(),
    scannedPackages: result.scannedPackages,
    deletedPackages: result.deletedPackages,
    deletedBytes: result.deletedBytes,
    deleted: result.deleted.map((downloadPackage) => ({
      id: downloadPackage.id,
      galleryId: downloadPackage.galleryId,
      r2Key: downloadPackage.r2Key,
      fileSize: downloadPackage.fileSize,
      generatedAt: downloadPackage.generatedAt?.toISOString() ?? null,
      lastDownloadedAt: downloadPackage.lastDownloadedAt?.toISOString() ?? null
    }))
  };
}

export async function deleteIdleGalleryDownloadPackages({
  maxIdleDays
}: {
  maxIdleDays?: number;
} = {}): Promise<R2DownloadPackageCleanupResult> {
  const config = r2Config();

  if (config.missingConfig.length > 0) {
    throw new Error(`Missing R2 configuration: ${config.missingConfig.join(", ")}`);
  }

  const effectiveMaxIdleDays =
    maxIdleDays ?? readPositiveInteger(process.env.R2_DOWNLOAD_PACKAGE_CLEANUP_MAX_IDLE_DAYS, DEFAULT_R2_DOWNLOAD_PACKAGE_CLEANUP_MAX_IDLE_DAYS, 1);
  const cutoff = new Date(Date.now() - effectiveMaxIdleDays * 24 * 60 * 60 * 1000);
  const candidates = await prisma.galleryDownloadPackage.findMany({
    where: {
      status: "completed",
      r2Key: { not: null },
      generatedAt: { lt: cutoff },
      OR: [{ lastDownloadedAt: null }, { lastDownloadedAt: { lt: cutoff } }]
    },
    orderBy: [{ lastDownloadedAt: "asc" }, { generatedAt: "asc" }],
    select: {
      id: true,
      galleryId: true,
      r2Key: true,
      fileSize: true,
      generatedAt: true,
      lastDownloadedAt: true
    }
  });
  const client = r2Client(config);
  const result: R2DownloadPackageCleanupResult = {
    bucket: config.bucket,
    maxIdleDays: effectiveMaxIdleDays,
    cutoff,
    scannedPackages: candidates.length,
    deletedPackages: 0,
    deletedBytes: 0,
    deleted: []
  };

  for (const downloadPackage of candidates) {
    if (!downloadPackage.r2Key) {
      continue;
    }

    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: downloadPackage.r2Key
      })
    );

    await prisma.galleryDownloadPackage.update({
      where: { id: downloadPackage.id },
      data: {
        status: "stale",
        r2Key: null,
        downloadUrl: null,
        accessToken: null,
        accessTokenExpiresAt: null,
        linkCreatedAt: null,
        errorMessage: `A ZIP R2 objektum törölve lett, mert ${effectiveMaxIdleDays} napja nem töltötték le.`
      }
    });

    const fileSize = Number(downloadPackage.fileSize);
    result.deletedPackages += 1;
    result.deletedBytes += Number.isFinite(fileSize) ? fileSize : 0;
    result.deleted.push({
      id: downloadPackage.id,
      galleryId: downloadPackage.galleryId,
      r2Key: downloadPackage.r2Key,
      fileSize: Number.isFinite(fileSize) ? fileSize : 0,
      generatedAt: downloadPackage.generatedAt,
      lastDownloadedAt: downloadPackage.lastDownloadedAt
    });
  }

  return result;
}

function payloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function payloadNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function runR2MultipartCleanupJob({ minAgeHours }: { minAgeHours?: number } = {}) {
  const effectiveMinAgeHours =
    minAgeHours ?? readPositiveInteger(process.env.R2_MULTIPART_CLEANUP_MIN_AGE_HOURS, DEFAULT_R2_MULTIPART_CLEANUP_MIN_AGE_HOURS, 1);
  const startedAt = new Date();
  const job = await prisma.backgroundJob.create({
    data: {
      type: R2_MULTIPART_CLEANUP_JOB_TYPE,
      status: "processing",
      payload: {
        minAgeHours: effectiveMinAgeHours,
        startedAt: startedAt.toISOString()
      },
      attempts: 1,
      maxAttempts: 1,
      lockedAt: startedAt,
      startedAt
    }
  });

  try {
    const result = await abortStaleR2MultipartUploads({ minAgeHours: effectiveMinAgeHours });

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        lockedAt: null,
        completedAt: new Date(),
        payload: {
          minAgeHours: effectiveMinAgeHours,
          result: cleanupResultToJson(result)
        }
      }
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "R2 multipart cleanup failed.";

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        lockedAt: null,
        completedAt: new Date(),
        errorMessage: message.slice(0, 500)
      }
    });

    throw error;
  }
}

export async function runR2CleanupJob({
  minAgeHours,
  maxIdleDays
}: {
  minAgeHours?: number;
  maxIdleDays?: number;
} = {}): Promise<R2FullCleanupResult> {
  const effectiveMinAgeHours =
    minAgeHours ?? readPositiveInteger(process.env.R2_MULTIPART_CLEANUP_MIN_AGE_HOURS, DEFAULT_R2_MULTIPART_CLEANUP_MIN_AGE_HOURS, 1);
  const effectiveMaxIdleDays =
    maxIdleDays ?? readPositiveInteger(process.env.R2_DOWNLOAD_PACKAGE_CLEANUP_MAX_IDLE_DAYS, DEFAULT_R2_DOWNLOAD_PACKAGE_CLEANUP_MAX_IDLE_DAYS, 1);
  const startedAt = new Date();
  const job = await prisma.backgroundJob.create({
    data: {
      type: R2_MULTIPART_CLEANUP_JOB_TYPE,
      status: "processing",
      payload: {
        minAgeHours: effectiveMinAgeHours,
        maxIdleDays: effectiveMaxIdleDays,
        startedAt: startedAt.toISOString()
      },
      attempts: 1,
      maxAttempts: 1,
      lockedAt: startedAt,
      startedAt
    }
  });

  try {
    const multipart = await abortStaleR2MultipartUploads({ minAgeHours: effectiveMinAgeHours });
    const downloadPackages = await deleteIdleGalleryDownloadPackages({ maxIdleDays: effectiveMaxIdleDays });
    const result = { multipart, downloadPackages };

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        lockedAt: null,
        completedAt: new Date(),
        payload: {
          minAgeHours: effectiveMinAgeHours,
          maxIdleDays: effectiveMaxIdleDays,
          result: {
            multipart: cleanupResultToJson(multipart),
            downloadPackages: downloadPackageCleanupResultToJson(downloadPackages)
          }
        }
      }
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "R2 cleanup failed.";

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        lockedAt: null,
        completedAt: new Date(),
        errorMessage: message.slice(0, 500)
      }
    });

    throw error;
  }
}

export async function getLatestR2CleanupRun(): Promise<R2CleanupRunSummary | null> {
  const job = await prisma.backgroundJob.findFirst({
    where: { type: R2_MULTIPART_CLEANUP_JOB_TYPE },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      errorMessage: true,
      payload: true
    }
  });

  if (!job) {
    return null;
  }

  const payload = payloadRecord(job.payload);
  const result = payloadRecord(payload.result);
  const multipartResult = payloadRecord(result.multipart);
  const uploadResult = Object.keys(multipartResult).length > 0 ? multipartResult : result;

  return {
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    errorMessage: job.errorMessage,
    minAgeHours: payloadNumber(payload.minAgeHours),
    scannedUploads: payloadNumber(uploadResult.scannedUploads),
    abortedUploads: payloadNumber(uploadResult.abortedUploads),
    skippedRecentUploads: payloadNumber(uploadResult.skippedRecentUploads),
    skippedUnknownAgeUploads: payloadNumber(uploadResult.skippedUnknownAgeUploads)
  };
}
