"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function approvePhotographerAction(adminId: string) {
  const approver = await requireSuperAdmin();

  await prisma.admin.update({
    where: { id: adminId },
    data: {
      status: "approved",
      approvedAt: new Date(),
      approvedById: approver.id
    }
  });

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
