import sharp from "sharp";
import { adminOwnedWhere } from "@/lib/admin-scope";
import { ALBUM_SPREAD_BACKGROUND, ALBUM_SPREAD_EXPORT_SLOT_INSET_PX } from "@/lib/album-design-templates";
import { prisma } from "@/lib/prisma";
import { getR2KeyFromPublicUrl, loadPhotoObjectBuffer } from "@/lib/storage";

type AdminSession = {
  id: string;
  role: string;
};

export type AlbumDesignSpreadExportData = {
  id: string;
  title: string | null;
  sortOrder: number;
  design: {
    title: string;
    customerId: string;
  };
  items: Array<{
    id: string;
    slotIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
    photo: {
      filename: string;
      r2Key: string;
      imageUrl: string;
      previewUrl: string;
    };
  }>;
};

const EXPORT_WIDTH = 3600;
const EXPORT_HEIGHT = 1800;

export async function loadAlbumDesignSpreadForExport({
  admin,
  spreadId
}: {
  admin: AdminSession;
  spreadId: string;
}) {
  return prisma.albumDesignSpread.findFirst({
    where: {
      id: spreadId,
      design: {
        customer: adminOwnedWhere(admin)
      }
    },
    select: {
      id: true,
      title: true,
      sortOrder: true,
      design: {
        select: {
          title: true,
          customerId: true
        }
      },
      items: {
        orderBy: { slotIndex: "asc" },
        select: {
          id: true,
          slotIndex: true,
          x: true,
          y: true,
          width: true,
          height: true,
          photo: {
            select: {
              filename: true,
              r2Key: true,
              imageUrl: true,
              previewUrl: true
            }
          }
        }
      }
    }
  });
}

export async function renderAlbumDesignSpreadJpeg(spread: AlbumDesignSpreadExportData) {
  const composites = await Promise.all(
    spread.items.map(async (item) => {
      const photoR2Key = getR2KeyFromPublicUrl(item.photo.previewUrl) ?? item.photo.r2Key;
      const photoBuffer = await loadPhotoObjectBuffer({
        r2Key: photoR2Key,
        publicUrl: item.photo.previewUrl || item.photo.imageUrl
      });
      const slotWidth = Math.round((item.width / 100) * EXPORT_WIDTH);
      const slotHeight = Math.round((item.height / 100) * EXPORT_HEIGHT);
      const width = Math.max(1, slotWidth - ALBUM_SPREAD_EXPORT_SLOT_INSET_PX * 2);
      const height = Math.max(1, slotHeight - ALBUM_SPREAD_EXPORT_SLOT_INSET_PX * 2);
      const input = await sharp(photoBuffer, { failOn: "none" })
        .rotate()
        .resize(width, height, { fit: "cover", position: "centre" })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();

      return {
        input,
        left: Math.round((item.x / 100) * EXPORT_WIDTH) + ALBUM_SPREAD_EXPORT_SLOT_INSET_PX,
        top: Math.round((item.y / 100) * EXPORT_HEIGHT) + ALBUM_SPREAD_EXPORT_SLOT_INSET_PX
      };
    })
  );

  return sharp({
    create: {
      width: EXPORT_WIDTH,
      height: EXPORT_HEIGHT,
      channels: 3,
      background: ALBUM_SPREAD_BACKGROUND
    }
  })
    .composite(composites)
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

export function albumDesignSpreadExportFilename(spread: AlbumDesignSpreadExportData) {
  const paddedSortOrder = String(spread.sortOrder).padStart(2, "0");

  return `album-oldalpar-${paddedSortOrder}.jpg`;
}
