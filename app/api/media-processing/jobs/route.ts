import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.MEDIA_PROCESSING_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return authHeader === `Bearer ${secret}`;
}

function clampLimit(value: unknown) {
  const limit = Number(value ?? 10);

  if (!Number.isFinite(limit)) {
    return 10;
  }

  return Math.min(25, Math.max(1, Math.floor(limit)));
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  const limit = clampLimit(body.limit);
  const staleCutoff = new Date(Date.now() - 30 * 60 * 1000);

  const jobs = await prisma.mediaProcessingJob.findMany({
    where: {
      OR: [
        { status: "pending" },
        {
          status: "processing",
          claimedAt: { lt: staleCutoff }
        }
      ]
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      galleryId: true,
      photoId: true,
      mediaType: true,
      sourceR2Key: true,
      thumbnailR2Key: true,
      previewR2Key: true,
      posterR2Key: true,
      attempts: true,
      photo: {
        select: {
          filename: true,
          imageUrl: true,
          thumbnailUrl: true,
          previewUrl: true
        }
      }
    }
  });

  const jobIds = jobs.map((job) => job.id);

  if (jobIds.length > 0) {
    await prisma.mediaProcessingJob.updateMany({
      where: { id: { in: jobIds } },
      data: {
        status: "processing",
        attempts: { increment: 1 },
        claimedAt: new Date(),
        errorMessage: null
      }
    });

    await prisma.photo.updateMany({
      where: { id: { in: jobs.map((job) => job.photoId) } },
      data: {
        processingStatus: "processing",
        processingError: null
      }
    });
  }

  return NextResponse.json({
    ok: true,
    jobs
  });
}
