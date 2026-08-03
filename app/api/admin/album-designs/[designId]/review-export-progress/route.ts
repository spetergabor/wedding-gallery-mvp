import { NextResponse } from "next/server";
import { albumDesignAccessWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ designId: string }> }) {
  const admin = await requireAdmin();
  const { designId } = await params;
  const design = await prisma.albumDesign.findFirst({
    where: albumDesignAccessWhere(admin, designId),
    select: {
      reviewExportStatus: true,
      reviewExportTotal: true,
      reviewExportCompleted: true,
      reviewExportStartedAt: true
    }
  });

  if (!design) {
    return NextResponse.json({ message: "Album design not found." }, { status: 404 });
  }

  return NextResponse.json(
    {
      status: design.reviewExportStatus,
      total: design.reviewExportTotal,
      completed: design.reviewExportCompleted,
      startedAt: design.reviewExportStartedAt?.toISOString() ?? null
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
