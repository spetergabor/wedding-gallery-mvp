"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { customerAccessWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createAlbumReviewSpreadObjectKey,
  createPresignedPhotoUploadUrl,
  getPhotoPublicUrl,
  isR2StorageEnabled
} from "@/lib/storage";

type AlbumSpreadUploadRequest = {
  clientId: string;
  filename: string;
  contentType: string;
  fileSize: number;
};

type CompletedAlbumSpreadUpload = {
  clientId: string;
  filename: string;
  r2Key: string;
  imageUrl: string;
  fileSize: number;
  sortOrder: number;
  title: string;
};

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

function isImageUploadRequest(file: AlbumSpreadUploadRequest) {
  return (
    file.clientId &&
    file.filename &&
    file.fileSize > 0 &&
    (file.contentType.startsWith("image/") || /\.(jpe?g|png|webp|gif|tiff?|heic)$/i.test(file.filename))
  );
}

export async function createAlbumReviewSpreadUploadTargetsAction(
  customerId: string,
  reviewId: string,
  files: AlbumSpreadUploadRequest[]
) {
  const { review } = await requireAlbumReviewAccess(customerId, reviewId);
  const normalizedFiles = files.filter(isImageUploadRequest).slice(0, 50);

  if (!isR2StorageEnabled()) {
    return {
      ok: false,
      message: "Az album oldalpárok feltöltéséhez R2 tárhely szükséges."
    };
  }

  if (normalizedFiles.length === 0) {
    return {
      ok: false,
      message: "Válassz ki legalább egy album oldalpár képet."
    };
  }

  try {
    const existingCount = review._count.spreads;
    const uploads = await Promise.all(
      normalizedFiles.map(async (file, index) => {
        const sortOrder = existingCount + index + 1;
        const title = `Oldalpár ${sortOrder}`;
        const r2Key = createAlbumReviewSpreadObjectKey({
          customerId,
          reviewId: review.id,
          originalFilename: file.filename
        });
        const imageUrl = getPhotoPublicUrl(r2Key);

        return {
          clientId: file.clientId,
          filename: file.filename,
          r2Key,
          imageUrl,
          fileSize: file.fileSize,
          sortOrder,
          title,
          uploadUrl: await createPresignedPhotoUploadUrl({
            r2Key,
            contentType: file.contentType || "application/octet-stream"
          })
        };
      })
    );

    return {
      ok: true,
      uploads
    };
  } catch (error) {
    console.error("Album review upload target creation failed", {
      customerId,
      reviewId,
      error
    });

    return {
      ok: false,
      message: "Nem sikerült előkészíteni az album oldalpár feltöltést."
    };
  }
}

export async function completeAlbumReviewSpreadUploadsAction(
  customerId: string,
  reviewId: string,
  uploads: CompletedAlbumSpreadUpload[]
) {
  const { review } = await requireAlbumReviewAccess(customerId, reviewId);
  const keyPrefix = `album-reviews/${customerId}/${review.id}/`;
  const spreads = uploads
    .filter((upload) => upload.r2Key.startsWith(keyPrefix) && upload.filename && upload.imageUrl)
    .map((upload) => ({
      filename: upload.filename,
      title: upload.title,
      r2Key: upload.r2Key,
      imageUrl: upload.imageUrl,
      fileSize: upload.fileSize,
      sortOrder: upload.sortOrder
    }));

  if (spreads.length === 0) {
    return {
      ok: false,
      message: "Nem érkezett menthető album oldalpár."
    };
  }

  try {
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

    return {
      ok: true,
      count: spreads.length
    };
  } catch (error) {
    console.error("Album review upload completion failed", {
      customerId,
      reviewId,
      error
    });

    return {
      ok: false,
      message: "Az album oldalpárok feltöltődtek, de a mentés nem sikerült."
    };
  }
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
