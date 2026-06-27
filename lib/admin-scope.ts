import type { Prisma } from "@prisma/client";

type AdminSession = {
  id: string;
  role: string;
};

export function adminOwnedWhere(admin: AdminSession) {
  return { adminId: admin.id };
}

export function customerAccessWhere(admin: AdminSession, customerId: string): Prisma.CustomerWhereInput {
  return {
    id: customerId,
    ...adminOwnedWhere(admin)
  };
}

export function notificationWhere(admin: AdminSession): Prisma.AdminNotificationWhereInput {
  return { adminId: admin.id };
}

export function ownerAdminId(admin: AdminSession, fallbackAdminId?: string | null) {
  return fallbackAdminId ?? admin.id;
}
