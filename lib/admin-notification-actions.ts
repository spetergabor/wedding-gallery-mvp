"use server";

import { revalidatePath } from "next/cache";
import { notificationWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function markAllNotificationsReadAction() {
  const admin = await requireAdmin();

  await prisma.adminNotification.updateMany({
    where: { ...notificationWhere(admin), readAt: null },
    data: { readAt: new Date() }
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/notifications");
}
