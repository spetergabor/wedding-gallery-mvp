import { revalidatePath } from "next/cache";
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

type CompletePayload = {
  jobId?: string;
  status?: "completed" | "failed";
  thumbnailUrl?: string;
  previewUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  errorMessage?: string;
};

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as CompletePayload;

  if (!body.jobId || (body.status !== "completed" && body.status !== "failed")) {
    return NextResponse.json({ ok: false, message: "Invalid media processing completion payload." }, { status: 400 });
  }

  const job = await prisma.mediaProcessingJob.findUnique({
    where: { id: body.jobId },
    select: {
      id: true,
      galleryId: true,
      photoId: true,
      status: true,
      gallery: {
        select: { slug: true }
      }
    }
  });

  if (!job) {
    return NextResponse.json({ ok: false, message: "Media processing job was not found." }, { status: 404 });
  }

  if (body.status === "failed") {
    const message = (body.errorMessage || "Media processing failed.").slice(0, 500);

    await prisma.$transaction([
      prisma.mediaProcessingJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMessage: message,
          completedAt: new Date()
        }
      }),
      prisma.photo.update({
        where: { id: job.photoId },
        data: {
          processingStatus: "failed",
          processingError: message
        }
      })
    ]);

    revalidatePath(`/admin/galleries/${job.galleryId}`);

    return NextResponse.json({ ok: true });
  }

  const imageWidth = Number.isFinite(body.imageWidth) ? Math.max(0, Math.floor(body.imageWidth ?? 0)) : undefined;
  const imageHeight = Number.isFinite(body.imageHeight) ? Math.max(0, Math.floor(body.imageHeight ?? 0)) : undefined;

  await prisma.$transaction([
    prisma.mediaProcessingJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        errorMessage: null,
        completedAt: new Date()
      }
    }),
    prisma.photo.update({
      where: { id: job.photoId },
      data: {
        ...(body.thumbnailUrl ? { thumbnailUrl: body.thumbnailUrl } : {}),
        ...(body.previewUrl ? { previewUrl: body.previewUrl } : {}),
        ...(imageWidth !== undefined ? { imageWidth } : {}),
        ...(imageHeight !== undefined ? { imageHeight } : {}),
        processingStatus: "ready",
        processingError: null,
        processingCompletedAt: new Date()
      }
    })
  ]);

  revalidatePath(`/admin/galleries/${job.galleryId}`);
  revalidatePath(`/g/${job.gallery.slug}`);
  revalidatePath(`/client/${job.gallery.slug}`);

  return NextResponse.json({ ok: true });
}
