import { NextResponse } from "next/server";
import { galleryAccessWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_PROCESSING_MS = 15 * 60 * 1000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const gallery = await prisma.gallery.findFirst({
    where: galleryAccessWhere(admin, id),
    select: {
      downloadPackages: {
        orderBy: { createdAt: "desc" },
        take: 120,
        select: {
          id: true,
          groupId: true,
          status: true,
          partIndex: true,
          partCount: true,
          updatedAt: true
        }
      }
    }
  });

  if (!gallery) {
    return NextResponse.json({ message: "Gallery not found." }, { status: 404 });
  }

  const now = Date.now();
  const activePackage = gallery.downloadPackages.find(
    (downloadPackage) =>
      downloadPackage.status === "pending" ||
      (downloadPackage.status === "processing" && now - downloadPackage.updatedAt.getTime() <= STALE_PROCESSING_MS)
  );
  const groupKey = activePackage ? activePackage.groupId ?? activePackage.id : null;
  const groupPackages = groupKey
    ? gallery.downloadPackages.filter((downloadPackage) => (downloadPackage.groupId ?? downloadPackage.id) === groupKey)
    : [];
  const totalParts = groupPackages.reduce(
    (total, downloadPackage) => Math.max(total, downloadPackage.partCount),
    groupPackages.length > 0 ? groupPackages.length : 0
  );
  const completedParts = new Set(
    groupPackages
      .filter((downloadPackage) => downloadPackage.status === "completed")
      .map((downloadPackage) => downloadPackage.partIndex)
  ).size;

  return NextResponse.json(
    {
      active: Boolean(activePackage),
      completedParts,
      totalParts,
      checkedAt: new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
