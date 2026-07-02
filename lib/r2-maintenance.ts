import {
  AbortMultipartUploadCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  S3Client
} from "@aws-sdk/client-s3";
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

async function listMultipartUploads(client: S3Client, bucket: string) {
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

      const parts = await listMultipartUploadParts(client, bucket, upload.Key, upload.UploadId);

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

  return uploads.sort((left, right) => right.partBytes - left.partBytes);
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
