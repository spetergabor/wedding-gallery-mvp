import type { Prisma } from "@prisma/client";

type AdminSession = {
  id: string;
  role: string;
  workspaceAdminId?: string | null;
};

export function ownerAdminId(admin: AdminSession) {
  return admin.workspaceAdminId ?? admin.id;
}

export function adminOwnedWhere(admin: AdminSession) {
  return { adminId: ownerAdminId(admin) };
}

export function galleryAccessWhere(admin: AdminSession, galleryId: string): Prisma.GalleryWhereInput {
  return {
    id: galleryId,
    ...adminOwnedWhere(admin)
  };
}

export function customerAccessWhere(admin: AdminSession, customerId: string): Prisma.CustomerWhereInput {
  return {
    id: customerId,
    ...adminOwnedWhere(admin)
  };
}

export function customerProjectAccessWhere(admin: AdminSession, projectId: string): Prisma.CustomerProjectWhereInput {
  return {
    id: projectId,
    customer: adminOwnedWhere(admin)
  };
}

export function photoAccessWhere(admin: AdminSession, photoId: string): Prisma.PhotoWhereInput {
  return {
    id: photoId,
    gallery: adminOwnedWhere(admin)
  };
}

export function galleryPhotoAccessWhere(admin: AdminSession, galleryId: string, photoId: string): Prisma.PhotoWhereInput {
  return {
    id: photoId,
    galleryId,
    gallery: adminOwnedWhere(admin)
  };
}

export function contractAccessWhere(admin: AdminSession, contractId: string): Prisma.ContractWhereInput {
  return {
    id: contractId,
    customer: adminOwnedWhere(admin)
  };
}

export function customerContractAccessWhere(
  admin: AdminSession,
  customerId: string,
  contractId: string
): Prisma.ContractWhereInput {
  return {
    id: contractId,
    customerId,
    customer: customerAccessWhere(admin, customerId)
  };
}

export function invoiceAccessWhere(admin: AdminSession, invoiceId: string): Prisma.CustomerInvoiceWhereInput {
  return {
    id: invoiceId,
    customer: adminOwnedWhere(admin)
  };
}

export function customerInvoiceAccessWhere(
  admin: AdminSession,
  customerId: string,
  invoiceId: string
): Prisma.CustomerInvoiceWhereInput {
  return {
    id: invoiceId,
    customerId,
    customer: customerAccessWhere(admin, customerId)
  };
}

export function favoriteListAccessWhere(admin: AdminSession, listId: string): Prisma.GalleryFavoriteListWhereInput {
  return {
    id: listId,
    gallery: adminOwnedWhere(admin)
  };
}

export function albumReviewAccessWhere(admin: AdminSession, reviewId: string): Prisma.AlbumReviewWhereInput {
  return {
    id: reviewId,
    customer: adminOwnedWhere(admin)
  };
}

export function albumDesignOwnedWhere(admin: AdminSession): Prisma.AlbumDesignWhereInput {
  return {
    OR: [
      { adminId: ownerAdminId(admin) },
      { customer: adminOwnedWhere(admin) }
    ]
  };
}

export function albumDesignAccessWhere(admin: AdminSession, designId: string): Prisma.AlbumDesignWhereInput {
  return {
    id: designId,
    ...albumDesignOwnedWhere(admin)
  };
}

export function notificationWhere(admin: AdminSession): Prisma.AdminNotificationWhereInput {
  return { adminId: ownerAdminId(admin) };
}
