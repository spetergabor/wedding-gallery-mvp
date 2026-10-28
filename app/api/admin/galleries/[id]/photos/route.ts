import { NextResponse } from "next/server";
import { galleryAccessWhere } from "@/lib/admin-scope";
import { ADMIN_GALLERY_PHOTO_PAGE_SIZE, loadAdminGalleryPhotoPage } from "@/lib/admin-gallery-photo-page";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function integerParam(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const gallery = await prisma.gallery.findFirst({
    where: galleryAccessWhere(admin, id),
    select: {
      id: true,
      galleryMode: true,
      favoriteLists: {
        select: {
          items: {
            select: { photoId: true }
          }
        }
      }
    }
  });

  if (!gallery) {
    return NextResponse.json({ message: "Gallery not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const offset = integerParam(url.searchParams.get("offset"), 0);
  const selectedPhotoIds = Array.from(
    new Set(gallery.favoriteLists.flatMap((list) => list.items.map((item) => item.photoId)))
  );
  const page = await loadAdminGalleryPhotoPage({
    galleryId: gallery.id,
    galleryMode: gallery.galleryMode,
    selectedPhotoIds,
    activeSet: url.searchParams.get("photoSet"),
    activeSearch: url.searchParams.get("photoSearch"),
    offset,
    limit: ADMIN_GALLERY_PHOTO_PAGE_SIZE
  });

  return NextResponse.json(page, {
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
