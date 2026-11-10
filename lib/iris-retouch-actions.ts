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
  await prisma.$transaction([
    prisma.irisRetouchIntegration.deleteMany({ where: { adminId } }),
    prisma.irisMomentDevice.updateMany({ where: { adminId }, data: { revokedAt: new Date() } })
  ]);
  revalidatePath("/admin/mini-sessions/irismoment");
  redirect("/admin/mini-sessions/irismoment?revoked=1");
}

export async function approveIrisMomentDeviceAction(authorizationId: string) {
  const admin = await requireAdmin();
  const adminId = ownerAdminId(admin);
  const authorization = await prisma.irisMomentDeviceAuthorization.findUnique({
    where: { id: authorizationId }
  });
  if (!authorization || authorization.status !== "pending" || authorization.expiresAt <= new Date()) {
    redirect(`/admin/mini-sessions/irismoment/devices/authorize?id=${encodeURIComponent(authorizationId)}&expired=1`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.irisMomentDevice.upsert({
      where: {
        adminId_externalId: { adminId, externalId: authorization.deviceExternalId }
      },
      create: {
        adminId,
        externalId: authorization.deviceExternalId,
        name: authorization.deviceName,
        appVersion: authorization.appVersion,
        tokenHash: authorization.tokenHash,
        lastSeenAt: new Date()
      },
      update: {
        name: authorization.deviceName,
        appVersion: authorization.appVersion,
        tokenHash: authorization.tokenHash,
        lastSeenAt: new Date(),
        revokedAt: null
      }
    });
    await tx.irisMomentDeviceAuthorization.update({
      where: { id: authorization.id },
      data: { adminId, status: "approved", approvedAt: new Date() }
    });
  });
  revalidatePath("/admin/mini-sessions/irismoment");
  redirect(`/admin/mini-sessions/irismoment/devices/authorize?id=${encodeURIComponent(authorizationId)}&approved=1`);
}

export async function revokeIrisMomentDeviceAction(deviceId: string) {
  const admin = await requireAdmin();
  const adminId = ownerAdminId(admin);
  await prisma.irisMomentDevice.updateMany({
    where: { id: deviceId, adminId },
    data: { revokedAt: new Date() }
  });
  revalidatePath("/admin/mini-sessions/irismoment");
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
