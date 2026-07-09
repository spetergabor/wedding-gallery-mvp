"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { albumReviewAccessWhere, customerAccessWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createAlbumReviewSpreadObjectKey,
  createPresignedPhotoUploadUrl,
  deletePhotoObject,
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

async function albumProjectIdForCustomer(admin: Awaited<ReturnType<typeof requireAdmin>>, customerId: string, projectId: string) {
  if (!projectId) {
    return null;
  }

  const project = await prisma.customerProject.findFirst({
    where: {
      id: projectId,
      customer: customerAccessWhere(admin, customerId),
      projectType: "album"
    },
    select: { id: true }
  });

  return project?.id ?? null;
}

function normalizePoint(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

export async function ensureAlbumReviewApprovalSchema() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "AlbumReviewSpread" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3)`);
}

async function requireAlbumReviewAccess(customerId: string, reviewId: string) {
  const admin = await requireAdmin();
  const review = await prisma.albumReview.findFirst({
    where: {
      ...albumReviewAccessWhere(admin, reviewId),
      customerId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: {
      id: true,
      customerId: true,
      title: true,
      accessToken: true
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
  const requestedProjectId = formString(formData, "projectId");
  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
    select: { id: true, primaryEmail: true }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  const projectId = await albumProjectIdForCustomer(admin, customer.id, requestedProjectId);

  if (requestedProjectId && !projectId) {
    redirect(`/admin/clients/${customerId}?tab=album&albumMode=upload&albumError=project`);
  }

  await prisma.albumReview.create({
    data: {
      customerId: customer.id,
      projectId,
      title,
      clientEmail: customer.primaryEmail,
      accessToken: createAlbumAccessToken()
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${customerId}?tab=album&albumMode=upload&albumCreated=1`);
}

export async function updateAlbumReviewProjectAction(customerId: string, reviewId: string, formData: FormData) {
  const { admin, review } = await requireAlbumReviewAccess(customerId, reviewId);
  const requestedProjectId = formString(formData, "projectId");
  const projectId = await albumProjectIdForCustomer(admin, review.customerId, requestedProjectId);

  if (requestedProjectId && !projectId) {
    redirect(`/admin/clients/${customerId}?tab=album&albumMode=upload&albumError=project`);
  }

  await prisma.albumReview.update({
    where: { id: review.id },
    data: { projectId }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath("/admin/clients");
  redirect(`/admin/clients/${customerId}?tab=album&albumMode=upload&albumUpdated=1`);
}

export async function deleteAlbumReviewAction(customerId: string, reviewId: string) {
  const { review } = await requireAlbumReviewAccess(customerId, reviewId);
  const spreads = await prisma.albumReviewSpread.findMany({
    where: { reviewId: review.id },
    select: { r2Key: true }
  });

  await prisma.albumReview.delete({
    where: { id: review.id }
  });

  await Promise.all(spreads.map((spread) => deletePhotoObject(spread.r2Key)));

  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath(`/album/${review.accessToken}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumMode=upload&albumDeleted=1`);
}

function isImageUploadRequest(file: AlbumSpreadUploadRequest) {
  return (
    file.clientId &&
    file.filename &&
    file.fileSize > 0 &&
    (file.contentType.startsWith("image/") || /\.(jpe?g|png|webp|gif|tiff?|heic)$/i.test(file.filename))
  );
}

function compareAlbumSpreadFilenames(left: { filename: string }, right: { filename: string }) {
  return left.filename.localeCompare(right.filename, "hu", { numeric: true, sensitivity: "base" });
}

export async function createAlbumReviewSpreadUploadTargetsAction(
  customerId: string,
  reviewId: string,
  files: AlbumSpreadUploadRequest[]
) {
  const { review } = await requireAlbumReviewAccess(customerId, reviewId);
  const normalizedFiles = files.filter(isImageUploadRequest).sort(compareAlbumSpreadFilenames).slice(0, 50);

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
    const latestSpread = await prisma.albumReviewSpread.findFirst({
      where: { reviewId: review.id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true }
    });
    const baseSortOrder = latestSpread?.sortOrder ?? 0;
    const uploads = await Promise.all(
      normalizedFiles.map(async (file, index) => {
        const sortOrder = baseSortOrder + index + 1;
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
    .sort(compareAlbumSpreadFilenames)
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
    revalidatePath(`/album/${review.accessToken}`);

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

export async function deleteAlbumReviewSpreadAction(customerId: string, reviewId: string, spreadId: string) {
  const { review } = await requireAlbumReviewAccess(customerId, reviewId);
  const spread = await prisma.albumReviewSpread.findFirst({
    where: {
      id: spreadId,
      reviewId: review.id
    },
    select: {
      id: true,
      r2Key: true
    }
  });

  if (!spread) {
    redirect(`/admin/clients/${customerId}?tab=album&albumError=missing`);
  }

  await prisma.albumReviewSpread.delete({
    where: { id: spread.id }
  });

  await deletePhotoObject(spread.r2Key);
  revalidatePath(`/admin/clients/${customerId}`);
  revalidatePath(`/album/${review.accessToken}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumMode=upload&albumSpreadDeleted=1`);
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
  await ensureAlbumReviewApprovalSchema();
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

  await prisma.$transaction([
    prisma.albumReviewSpread.update({
      where: { id: spread.id },
      data: { approvedAt: null }
    }),
    prisma.albumReview.update({
      where: { id: spread.reviewId },
      data: { status: "in_review" }
    })
  ]);

  revalidatePath(`/album/${token}`);

  return {
    ok: true,
    comment: {
      ...comment,
      createdAt: comment.createdAt.toISOString()
    }
  };
}

export async function updateAlbumReviewCommentAction({
  token,
  commentId,
  text
}: {
  token: string;
  commentId: string;
  text: string;
}) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return { ok: false, message: "Bitte geben Sie eine Notiz ein." };
  }

  const comment = await prisma.albumReviewComment.findFirst({
    where: {
      id: commentId,
      spread: {
        review: { accessToken: token }
      }
    },
    select: {
      id: true,
      spreadId: true,
      x: true,
      y: true,
      createdAt: true,
      spread: {
        select: {
          review: {
            select: {
              customerId: true
            }
          }
        }
      }
    }
  });

  if (!comment) {
    return { ok: false, message: "Diese Notiz wurde nicht gefunden." };
  }

  const updatedComment = await prisma.albumReviewComment.update({
    where: { id: comment.id },
    data: { text: normalizedText.slice(0, 1000) },
    select: {
      id: true,
      spreadId: true,
      x: true,
      y: true,
      text: true,
      createdAt: true
    }
  });

  revalidatePath(`/album/${token}`);
  revalidatePath(`/admin/clients/${comment.spread.review.customerId}`);

  return {
    ok: true,
    comment: {
      ...updatedComment,
      createdAt: updatedComment.createdAt.toISOString()
    }
  };
}

export async function deleteAlbumReviewCommentAction({
  token,
  commentId
}: {
  token: string;
  commentId: string;
}) {
  const comment = await prisma.albumReviewComment.findFirst({
    where: {
      id: commentId,
      spread: {
        review: { accessToken: token }
      }
    },
    select: {
      id: true,
      spread: {
        select: {
          review: {
            select: {
              customerId: true
            }
          }
        }
      }
    }
  });

  if (!comment) {
    return { ok: false, message: "Diese Notiz wurde nicht gefunden." };
  }

  await prisma.albumReviewComment.delete({
    where: { id: comment.id }
  });

  revalidatePath(`/album/${token}`);
  revalidatePath(`/admin/clients/${comment.spread.review.customerId}`);

  return { ok: true, commentId: comment.id };
}

export async function approveAlbumReviewSpreadAction({
  token,
  spreadId
}: {
  token: string;
  spreadId: string;
}) {
  await ensureAlbumReviewApprovalSchema();
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

  const updatedSpread = await prisma.albumReviewSpread.update({
    where: { id: spread.id },
    data: { approvedAt: new Date() },
    select: { approvedAt: true }
  });

  await prisma.albumReview.update({
    where: { id: spread.reviewId },
    data: { status: "in_review" }
  });

  revalidatePath(`/album/${token}`);

  return {
    ok: true,
    approvedAt: updatedSpread.approvedAt?.toISOString() ?? null
  };
}
