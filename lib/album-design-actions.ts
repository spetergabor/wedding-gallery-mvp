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
      favoriteListId: true,
      _count: {
        select: { spreads: true }
      }
    }
  });

  if (!design) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=missing`);
  }

  return { admin, design };
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
  const selectedPhotoIds = formData
    .getAll("photoIds")
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, layout.photoCount);

  if (selectedPhotoIds.length !== layout.photoCount) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=photo-count`);
  }

  const photos = await prisma.photo.findMany({
    where: {
      id: { in: selectedPhotoIds },
      favoriteItems: {
        some: {
          listId: design.favoriteListId
        }
      }
    },
    select: { id: true }
  });
  const photoIds = selectedPhotoIds.filter((photoId) => photos.some((photo) => photo.id === photoId));

  if (photoIds.length !== layout.photoCount) {
    redirect(`/admin/clients/${customerId}?tab=album&albumDesignError=invalid-photos`);
  }

  const sortOrder = design._count.spreads + 1;
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
