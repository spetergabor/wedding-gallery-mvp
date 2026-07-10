"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultPublicSubdomainForAdmin } from "@/lib/public-subdomain";

export async function approvePhotographerAction(adminId: string) {
  const approver = await requireSuperAdmin();

  const photographer = await prisma.admin.update({
    where: { id: adminId },
    data: {
      status: "approved",
      approvedAt: new Date(),
      approvedById: approver.id
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });

  await ensureDefaultPublicSubdomainForAdmin(photographer);

  revalidatePath("/admin/photographers");
  redirect("/admin/photographers?approved=1");
}

export async function rejectPhotographerAction(adminId: string) {
  await requireSuperAdmin();

  await prisma.admin.update({
    where: { id: adminId },
    data: {
      status: "rejected",
      approvedAt: null,
      approvedById: null
    }
  });

  revalidatePath("/admin/photographers");
  redirect("/admin/photographers?rejected=1");
}
