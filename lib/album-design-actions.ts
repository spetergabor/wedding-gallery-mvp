"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { customerAccessWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { getAlbumLayoutTemplate } from "@/lib/album-design-templates";
import { prisma } from "@/lib/prisma";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formInteger(formData: FormData, key: string) {
  const value = formString(formData, key);
  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function getSelectedPhotoIds(formData: FormData) {
  return [
    ...new Set(
      formData
        .getAll("photoIds")
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    )
  ];
}

async function requireCustomerAccess(customerId: string) {
  const admin = await requireAdmin();
  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
    select: { id: true }
  });

  if (!customer) {
    redirect("/admin/clients");
  }

  return { admin, customer };
}

async function requireAlbumDesignAccess(customerId: string, designId: string) {
  const { admin } = await requireCustomerAccess(customerId);
  const design = await prisma.albumDesign.findFirst({
    where: {
      id: designId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: {
      id: true,
      customerId: true,
      favoriteListId: true
    }
  });

  if (!design) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=missing`);
  }

  return { admin, design };
}

async function getVerifiedDesignPhotoIds({
  customerId,
  favoriteListId,
  formData,
  photoCount
}: {
  customerId: string;
  favoriteListId: string;
  formData: FormData;
  photoCount: number;
}) {
  const selectedPhotoIds = getSelectedPhotoIds(formData);

  if (selectedPhotoIds.length !== photoCount) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=photo-count`);
  }

  const photos = await prisma.photo.findMany({
    where: {
      id: { in: selectedPhotoIds },
      favoriteItems: {
        some: {
          listId: favoriteListId
        }
      }
    },
    select: { id: true }
  });
  const validPhotoIds = new Set(photos.map((photo) => photo.id));
  const photoIds = selectedPhotoIds.filter((photoId) => validPhotoIds.has(photoId));

  if (photoIds.length !== photoCount) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=invalid-photos`);
  }

  return photoIds;
}

async function requireFavoritePhoto({
  customerId,
  favoriteListId,
  photoId
}: {
  customerId: string;
  favoriteListId: string;
  photoId: string;
}) {
  const photo = await prisma.photo.findFirst({
    where: {
      id: photoId,
      favoriteItems: {
        some: {
          listId: favoriteListId
        }
      }
    },
    select: { id: true }
  });

  if (!photo) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=invalid-photos`);
  }

  return photo;
}

export async function createAlbumDesignAction(customerId: string, formData: FormData) {
  const { admin, customer } = await requireCustomerAccess(customerId);
  const title = formString(formData, "title") || "Albumterv";
  const favoriteListId = formString(formData, "favoriteListId");
  const favoriteList = await prisma.galleryFavoriteList.findFirst({
    where: {
      id: favoriteListId,
      gallery: {
        customer: customerAccessWhere(admin, customer.id)
      }
    },
    select: { id: true }
  });

  if (!favoriteList) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=favorite-list`);
  }

  await prisma.albumDesign.create({
    data: {
      customerId: customer.id,
      favoriteListId: favoriteList.id,
      title
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumDesignCreated=1`);
}

export async function createAlbumDesignSpreadAction(customerId: string, designId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=favorite-list`);
  }

  const layout = getAlbumLayoutTemplate(formString(formData, "layoutKey"));
  const photoIds = await getVerifiedDesignPhotoIds({
    customerId,
    favoriteListId: design.favoriteListId,
    formData,
    photoCount: layout.photoCount
  });

  const latestSpread = await prisma.albumDesignSpread.findFirst({
    where: { designId: design.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });
  const sortOrder = (latestSpread?.sortOrder ?? 0) + 1;

  await prisma.albumDesignSpread.create({
    data: {
      designId: design.id,
      title: `Oldalpár ${sortOrder}`,
      layoutKey: layout.key,
      sortOrder,
      items: {
        create: layout.slots.map((slot, index) => ({
          photoId: photoIds[index],
          slotIndex: index,
          x: slot.x,
          y: slot.y,
          width: slot.width,
          height: slot.height
        }))
      }
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumSpreadCreated=1`);
}

export async function updateAlbumDesignSpreadAction(customerId: string, designId: string, spreadId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=favorite-list`);
  }

  const spread = await prisma.albumDesignSpread.findFirst({
    where: {
      id: spreadId,
      designId: design.id
    },
    select: { id: true }
  });

  if (!spread) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=missing`);
  }

  const layout = getAlbumLayoutTemplate(formString(formData, "layoutKey"));
  const photoIds = await getVerifiedDesignPhotoIds({
    customerId,
    favoriteListId: design.favoriteListId,
    formData,
    photoCount: layout.photoCount
  });

  await prisma.albumDesignSpread.update({
    where: { id: spread.id },
    data: {
      layoutKey: layout.key,
      items: {
        deleteMany: {},
        create: layout.slots.map((slot, index) => ({
          photoId: photoIds[index],
          slotIndex: index,
          x: slot.x,
          y: slot.y,
          width: slot.width,
          height: slot.height
        }))
      }
    }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumSpreadUpdated=1`);
}

export async function updateAlbumDesignSpreadSlotAction(customerId: string, designId: string, spreadId: string, formData: FormData) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);

  if (!design.favoriteListId) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=favorite-list`);
  }

  const slotIndex = formInteger(formData, "slotIndex");
  const photoId = formString(formData, "photoId");

  if (slotIndex === null || !photoId) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=slot`);
  }

  const spread = await prisma.albumDesignSpread.findFirst({
    where: {
      id: spreadId,
      designId: design.id
    },
    select: {
      id: true,
      layoutKey: true
    }
  });

  if (!spread) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=missing`);
  }

  const layout = getAlbumLayoutTemplate(spread.layoutKey);
  const slot = layout.slots[slotIndex];

  if (!slot) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=slot`);
  }

  await requireFavoritePhoto({
    customerId,
    favoriteListId: design.favoriteListId,
    photoId
  });

  const item = await prisma.albumDesignSpreadItem.findFirst({
    where: {
      spreadId: spread.id,
      slotIndex
    },
    select: { id: true }
  });

  if (item) {
    await prisma.albumDesignSpreadItem.update({
      where: { id: item.id },
      data: { photoId }
    });
  } else {
    await prisma.albumDesignSpreadItem.create({
      data: {
        spreadId: spread.id,
        photoId,
        slotIndex,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height
      }
    });
  }

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumSpreadSlotUpdated=1`);
}

export async function deleteAlbumDesignSpreadAction(customerId: string, designId: string, spreadId: string) {
  const { design } = await requireAlbumDesignAccess(customerId, designId);
  const spread = await prisma.albumDesignSpread.findFirst({
    where: {
      id: spreadId,
      designId: design.id
    },
    select: { id: true }
  });

  if (!spread) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=missing`);
  }

  await prisma.albumDesignSpread.delete({
    where: { id: spread.id }
  });

  revalidatePath(`/admin/clients/${customerId}`);
  redirect(`/admin/clients/${customerId}?tab=album&albumSpreadDeleted=1`);
}
