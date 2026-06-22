"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { customerAccessWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAlbumReviewSpreadObjectKey, getPhotoPublicUrl, savePhotoObject } from "@/lib/storage";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function createAlbumAccessToken() {
  return randomBytes(32).toString("base64url");
}

function normalizePoint(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

async function requireAlbumReviewAccess(customerId: string, reviewId: string) {
  const admin = await requireAdmin();
  const review = await prisma.albumReview.findFirst({
    where: {
      id: reviewId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: {
      id: true,
      customerId: true,
      title: true,
      _count: {
        select: { spreads: true }
      }
    }
  });

  if (!review) {
    redirect(`/admin/clients/${customerId}?tab=album&albumError=missing`);
  }

  return { admin, review };
}

export async function createAlbumReviewAction(customerId: string, formData: FormData) {
  const admin = await requireAdmin();
  const title = formString(formData, "title") || "Album ellenőrző";
  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
    select: { id: true, primaryEmail: true }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  await prisma.albumReview.create({
    data: {
      customerId: customer.id,
      title,
      clientEmail: customer.primaryEmail,
      accessToken: createAlbumAccessToken()
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumCreated=1`);
}

export async function uploadAlbumReviewSpreadsAction(customerId: string, reviewId: string, formData: FormData) {
  const { review } = await requireAlbumReviewAccess(customerId, reviewId);
  const files = formData
    .getAll("albumSpreads")
    .filter((value): value is File => value instanceof File && value.size > 0 && value.type.startsWith("image/"));

  if (files.length === 0) {
    redirect(`/admin/clients/${customerId}?tab=album&albumError=no-files`);
  }

  const existingCount = review._count.spreads;
  const spreads = [];

  for (const [index, file] of files.entries()) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const r2Key = createAlbumReviewSpreadObjectKey({
      customerId,
      reviewId: review.id,
      originalFilename: file.name
    });

    await savePhotoObject({
      r2Key,
      bytes,
      contentType: file.type || "image/jpeg"
    });

    spreads.push({
      filename: file.name,
      title: `Oldalpár ${existingCount + index + 1}`,
      r2Key,
      imageUrl: getPhotoPublicUrl(r2Key),
      fileSize: file.size,
      sortOrder: existingCount + index + 1
    });
  }

  await prisma.albumReview.update({
    where: { id: review.id },
    data: {
      status: "ready",
      spreads: {
        createMany: {
          data: spreads
        }
      }
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumUploaded=${spreads.length}`);
}

export async function createAlbumReviewCommentAction({
  token,
  spreadId,
  x,
  y,
  text
}: {
  token: string;
  spreadId: string;
  x: number;
  y: number;
  text: string;
}) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return { ok: false, message: "Bitte geben Sie eine Notiz ein." };
  }

  const spread = await prisma.albumReviewSpread.findFirst({
    where: {
      id: spreadId,
      review: { accessToken: token }
    },
    select: {
      id: true,
      reviewId: true
    }
  });

  if (!spread) {
    return { ok: false, message: "Diese Albumseite wurde nicht gefunden." };
  }

  const comment = await prisma.albumReviewComment.create({
    data: {
      spreadId: spread.id,
      x: normalizePoint(x),
      y: normalizePoint(y),
      text: normalizedText.slice(0, 1000)
    },
    select: {
      id: true,
      spreadId: true,
      x: true,
      y: true,
      text: true,
      createdAt: true
    }
  });

  await prisma.albumReview.update({
    where: { id: spread.reviewId },
    data: { status: "in_review" }
  });

  revalidatePath(`/album/${token}`);

  return {
    ok: true,
    comment: {
      ...comment,
      createdAt: comment.createdAt.toISOString()
    }
  };
}
