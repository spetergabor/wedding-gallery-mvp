import { prisma } from "@/lib/prisma";

export type AdminStorageUsageRow = {
  adminId: string;
  storageBytes: bigint | number | null;
  photoCount: bigint | number | null;
};

export type NormalizedAdminStorageUsage = {
  adminId: string;
  storageBytes: bigint;
  photoCount: bigint;
};

function toBigInt(value: bigint | number | null | undefined) {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.max(0, Math.round(value)));
  }

  return BigInt(0);
}

export async function getAdminStorageUsageRows(): Promise<NormalizedAdminStorageUsage[]> {
  const rows = await prisma.$queryRaw<AdminStorageUsageRow[]>`
    WITH storage_rows AS (
      SELECT
        g."adminId" AS "adminId",
        COALESCE(SUM(p."fileSize"), 0)::bigint AS "storageBytes",
        COUNT(p."id")::bigint AS "photoCount"
      FROM "Gallery" g
      LEFT JOIN "Photo" p ON p."galleryId" = g."id"
      GROUP BY g."adminId"

      UNION ALL

      SELECT
        g."adminId" AS "adminId",
        COALESCE(SUM(dp."fileSize"), 0)::bigint AS "storageBytes",
        0::bigint AS "photoCount"
      FROM "Gallery" g
      JOIN "GalleryDownloadPackage" dp ON dp."galleryId" = g."id"
      WHERE dp."r2Key" IS NOT NULL
      GROUP BY g."adminId"

      UNION ALL

      SELECT
        g."adminId" AS "adminId",
        COALESCE(SUM(gui."fileSize"), 0)::bigint AS "storageBytes",
        0::bigint AS "photoCount"
      FROM "Gallery" g
      JOIN "GalleryUploadSession" gus ON gus."galleryId" = g."id"
      JOIN "GalleryUploadItem" gui ON gui."sessionId" = gus."id"
      WHERE gui."r2Key" IS NOT NULL
        AND gui."status" <> 'completed'
      GROUP BY g."adminId"

      UNION ALL

      SELECT
        c."adminId" AS "adminId",
        COALESCE(SUM(co."fileSize"), 0)::bigint AS "storageBytes",
        0::bigint AS "photoCount"
      FROM "Customer" c
      JOIN "Contract" co ON co."customerId" = c."id"
      WHERE co."r2Key" IS NOT NULL
      GROUP BY c."adminId"

      UNION ALL

      SELECT
        c."adminId" AS "adminId",
        COALESCE(SUM(inv."fileSize"), 0)::bigint AS "storageBytes",
        0::bigint AS "photoCount"
      FROM "Customer" c
      JOIN "CustomerInvoice" inv ON inv."customerId" = c."id"
      WHERE inv."r2Key" IS NOT NULL
      GROUP BY c."adminId"

      UNION ALL

      SELECT
        c."adminId" AS "adminId",
        COALESCE(SUM(sp."fileSize"), 0)::bigint AS "storageBytes",
        0::bigint AS "photoCount"
      FROM "Customer" c
      JOIN "AlbumReview" ar ON ar."customerId" = c."id"
      JOIN "AlbumReviewSpread" sp ON sp."reviewId" = ar."id"
      WHERE sp."r2Key" IS NOT NULL
      GROUP BY c."adminId"

      UNION ALL

      SELECT
        c."adminId" AS "adminId",
        COALESCE(SUM(cp."fileSize"), 0)::bigint AS "storageBytes",
        0::bigint AS "photoCount"
      FROM "Customer" c
      JOIN "CustomerPortalImage" cp ON cp."customerId" = c."id"
      WHERE cp."r2Key" IS NOT NULL
      GROUP BY c."adminId"
    )
    SELECT
      "adminId",
      COALESCE(SUM("storageBytes"), 0)::bigint AS "storageBytes",
      COALESCE(SUM("photoCount"), 0)::bigint AS "photoCount"
    FROM storage_rows
    GROUP BY "adminId"
  `;

  return rows.map((row) => ({
    adminId: row.adminId,
    storageBytes: toBigInt(row.storageBytes),
    photoCount: toBigInt(row.photoCount)
  }));
}

export async function getAdminStorageUsageForAdmin(adminId: string): Promise<NormalizedAdminStorageUsage> {
  const rows = await getAdminStorageUsageRows();

  return rows.find((row) => row.adminId === adminId) ?? { adminId, storageBytes: BigInt(0), photoCount: BigInt(0) };
}
