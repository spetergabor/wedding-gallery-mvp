"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import {
  createIrisRetouchToken,
  GALLERY_FULFILLMENT_MODE,
  hashIrisRetouchToken,
  IRIS_FULFILLMENT_MODE
} from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export async function generateIrisRetouchTokenAction() {
  const admin = await requireAdmin();
  const adminId = ownerAdminId(admin);
  const token = createIrisRetouchToken();
  await prisma.irisRetouchIntegration.upsert({
    where: { adminId },
    create: { adminId, tokenHash: hashIrisRetouchToken(token) },
    update: { tokenHash: hashIrisRetouchToken(token), createdAt: new Date(), lastUsedAt: null }
  });
  const cookieStore = await cookies();
  cookieStore.set("irismoment_token_once", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin/mini-sessions/irismoment",
    maxAge: 300
  });
  revalidatePath("/admin/mini-sessions/irismoment");
  redirect("/admin/mini-sessions/irismoment?created=1");
}

export async function revokeIrisRetouchTokenAction() {
  const admin = await requireAdmin();
  const adminId = ownerAdminId(admin);
  await prisma.irisRetouchIntegration.deleteMany({ where: { adminId } });
  revalidatePath("/admin/mini-sessions/irismoment");
  redirect("/admin/mini-sessions/irismoment?revoked=1");
}

export async function setIrisRetouchTagAction(id: string, enabled: boolean) {
  const admin = await requireAdmin();
  const adminId = ownerAdminId(admin);
  await prisma.miniSession.updateMany({
    where: { id, adminId },
    data: enabled
      ? {
          fulfillmentMode: IRIS_FULFILLMENT_MODE,
          createCustomerOnBooking: false,
          postProductionWorkflowEnabled: false
        }
      : { fulfillmentMode: GALLERY_FULFILLMENT_MODE }
  });
  revalidatePath("/admin/mini-sessions");
  revalidatePath("/admin/mini-sessions/irismoment");
}
