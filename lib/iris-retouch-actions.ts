"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { createIrisRetouchToken, hashIrisRetouchToken } from "@/lib/iris-retouch-auth";
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
  cookieStore.set("iris_retouch_token_once", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin/mini-sessions/iris-retouch",
    maxAge: 300
  });
  revalidatePath("/admin/mini-sessions/iris-retouch");
  redirect("/admin/mini-sessions/iris-retouch?created=1");
}

export async function revokeIrisRetouchTokenAction() {
  const admin = await requireAdmin();
  const adminId = ownerAdminId(admin);
  await prisma.irisRetouchIntegration.deleteMany({ where: { adminId } });
  revalidatePath("/admin/mini-sessions/iris-retouch");
  redirect("/admin/mini-sessions/iris-retouch?revoked=1");
}
