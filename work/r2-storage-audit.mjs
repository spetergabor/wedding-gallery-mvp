#!/usr/bin/env node

import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const dryRun = !args.has("--delete");
const deleteStaleZips = args.has("--delete-stale-zips");
const deleteOrphans = args.has("--delete-orphans");
const maxDelete = readNumberArg("--max-delete", 25);
const olderThanDays = readNumberArg("--older-than-days", 7);
const prefixFilter = readStringArg("--prefix");

function readStringArg(name) {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function readNumberArg(name, fallback) {
  const raw = readStringArg(name);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function addToSummary(map, key, bytes) {
  const current = map.get(key) ?? { count: 0, bytes: 0 };
  current.count += 1;
  current.bytes += Number(bytes || 0);
  map.set(key, current);
}

function rowsFromSummary(map, limit = 30) {
  return [...map.entries()]
    .map(([key, value]) => ({ key, count: value.count, bytes: value.bytes }))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, limit);
}

function printSummary(title, rows) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));

  if (rows.length === 0) {
    console.log("No rows.");
    return;
  }

  for (const row of rows) {
    console.log(`${row.key.padEnd(54)} ${String(row.count).padStart(7)} objects  ${formatBytes(row.bytes).padStart(12)}`);
  }
}

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

function requiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}. Add it to the environment before running this script.`);
  }

  return value;
}

function getPublicR2Key(value) {
  if (!value) {
    return null;
  }

  const publicBase = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

  if (publicBase && value.startsWith(`${publicBase}/`)) {
    return value.slice(publicBase.length + 1);
  }

  try {
    const url = new URL(value);
    return url.pathname.replace(/^\/+/, "") || null;
  } catch {
    return null;
  }
}

async function listR2Objects(client, bucket) {
  const objects = [];
  let ContinuationToken;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken,
        Prefix: prefixFilter || undefined
      })
    );

    for (const item of response.Contents ?? []) {
      objects.push({
        key: item.Key ?? "",
        size: Number(item.Size ?? 0),
        lastModified: item.LastModified ?? null
      });
    }

    ContinuationToken = response.NextContinuationToken;
  } while (ContinuationToken);

  return objects;
}

async function collectDatabaseReferences() {
  const [
    photos,
    downloadPackages,
    albumReviewSpreads,
    albumDesignExports,
    invoices,
    contracts,
    settings
  ] = await Promise.all([
    prisma.photo.findMany({
      select: {
        r2Key: true,
        thumbnailUrl: true,
        previewUrl: true
      }
    }),
    prisma.galleryDownloadPackage.findMany({
      select: {
        id: true,
        status: true,
        r2Key: true,
        fileSize: true,
        generatedAt: true,
        gallery: {
          select: {
            slug: true,
            title: true
          }
        }
      }
    }),
    prisma.albumReviewSpread.findMany({
      select: { r2Key: true }
    }),
    prisma.albumDesignSpreadItem.findMany({
      select: {
        photo: {
          select: { r2Key: true }
        }
      }
    }),
    prisma.customerInvoice.findMany({
      select: { r2Key: true }
    }),
    prisma.contract.findMany({
      select: {
        r2Key: true,
        signedR2Key: true
      }
    }),
    prisma.siteSettings.findMany({
      select: {
        logoR2Key: true,
        signatureR2Key: true
      }
    })
  ]);

  const referenced = new Set();

  function add(key) {
    if (key) {
      referenced.add(key);
    }
  }

  for (const photo of photos) {
    add(photo.r2Key);
    add(getPublicR2Key(photo.thumbnailUrl));
    add(getPublicR2Key(photo.previewUrl));
  }

  for (const spread of albumReviewSpreads) {
    add(spread.r2Key);
  }

  for (const item of albumDesignExports) {
    add(item.photo?.r2Key);
  }

  for (const invoice of invoices) {
    add(invoice.r2Key);
  }

  for (const contract of contracts) {
    add(contract.r2Key);
    add(contract.signedR2Key);
  }

  for (const siteSettings of settings) {
    add(siteSettings.logoR2Key);
    add(siteSettings.signatureR2Key);
  }

  for (const downloadPackage of downloadPackages) {
    if (downloadPackage.status !== "stale") {
      add(downloadPackage.r2Key);
    }
  }

  return {
    referenced,
    staleZipPackages: downloadPackages.filter((downloadPackage) => downloadPackage.status === "stale" && downloadPackage.r2Key)
  };
}

function isOlderThan(object, days) {
  if (!object.lastModified) {
    return false;
  }

  return Date.now() - object.lastModified.getTime() >= days * 24 * 60 * 60 * 1000;
}

async function deleteObjects(client, bucket, objects, reason) {
  const limitedObjects = objects.slice(0, maxDelete);

  console.log(`\nDelete candidate set: ${reason}`);
  console.log(`Candidates: ${objects.length}, max this run: ${limitedObjects.length}, dry run: ${dryRun ? "yes" : "no"}`);

  for (const object of limitedObjects) {
    console.log(`${dryRun ? "DRY RUN" : "DELETE"} ${formatBytes(object.size).padStart(10)} ${object.key}`);

    if (!dryRun) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.key }));
    }
  }
}

async function main() {
  const bucket = process.env.R2_BUCKET_NAME?.trim() || "wedding-gallery";
  const endpoint = r2Endpoint();
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");

  if (!endpoint) {
    throw new Error("Missing R2_ENDPOINT or CLOUDFLARE_ACCOUNT_ID.");
  }

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  const [{ referenced, staleZipPackages }, objects] = await Promise.all([
    collectDatabaseReferences(),
    listR2Objects(client, bucket)
  ]);
  const objectByKey = new Map(objects.map((object) => [object.key, object]));
  const staleZipKeys = new Set(staleZipPackages.map((downloadPackage) => downloadPackage.r2Key).filter(Boolean));
  const staleZipObjects = [...staleZipKeys]
    .map((key) => objectByKey.get(key))
    .filter(Boolean)
    .filter((object) => isOlderThan(object, olderThanDays));
  const orphanObjects = objects
    .filter((object) => object.key && !referenced.has(object.key))
    .filter((object) => isOlderThan(object, olderThanDays));
  const summaries = {
    topPrefix: new Map(),
    galleryFolder: new Map(),
    galleryTotal: new Map(),
    extension: new Map()
  };
  let totalBytes = 0;

  for (const object of objects) {
    totalBytes += object.size;
    const parts = object.key.split("/");
    addToSummary(summaries.topPrefix, parts[0] || "(root)", object.size);
    addToSummary(summaries.extension, object.key.includes(".") ? object.key.split(".").pop().toLowerCase() : "(none)", object.size);

    if (parts[0] === "galleries") {
      addToSummary(summaries.galleryTotal, parts[1] || "(missing)", object.size);
      addToSummary(summaries.galleryFolder, `${parts[1] || "(missing)"}/${parts[2] || "(root)"}`, object.size);
    }
  }

  console.log(`Bucket: ${bucket}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Prefix filter: ${prefixFilter || "(none)"}`);
  console.log(`Objects listed: ${objects.length}`);
  console.log(`Total listed size: ${formatBytes(totalBytes)}`);
  console.log(`DB referenced keys: ${referenced.size}`);
  console.log(`Stale ZIP rows in DB: ${staleZipPackages.length}`);
  console.log(`Stale ZIP objects older than ${olderThanDays} days: ${staleZipObjects.length} (${formatBytes(staleZipObjects.reduce((sum, object) => sum + object.size, 0))})`);
  console.log(`Orphan objects older than ${olderThanDays} days: ${orphanObjects.length} (${formatBytes(orphanObjects.reduce((sum, object) => sum + object.size, 0))})`);

  printSummary("Top prefixes", rowsFromSummary(summaries.topPrefix));
  printSummary("Largest galleries", rowsFromSummary(summaries.galleryTotal));
  printSummary("Largest gallery folders", rowsFromSummary(summaries.galleryFolder));
  printSummary("Largest extensions", rowsFromSummary(summaries.extension));

  const largestObjects = [...objects].sort((left, right) => right.size - left.size).slice(0, 30);
  printSummary(
    "Largest objects",
    largestObjects.map((object) => ({
      key: object.key.length > 54 ? `${object.key.slice(0, 51)}...` : object.key,
      count: 1,
      bytes: object.size
    }))
  );

  if (deleteStaleZips) {
    await deleteObjects(client, bucket, staleZipObjects, `stale ZIPs older than ${olderThanDays} days`);
  }

  if (deleteOrphans) {
    await deleteObjects(client, bucket, orphanObjects, `DB orphan objects older than ${olderThanDays} days`);
  }

  if (!deleteStaleZips && !deleteOrphans) {
    console.log("\nNo delete flags passed. Audit only.");
    console.log("To delete stale ZIP objects: add --delete-stale-zips --delete --max-delete=25");
    console.log("To delete orphan objects: add --delete-orphans --delete --max-delete=25");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
