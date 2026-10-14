"use server";

import { redirect } from "next/navigation";
import {
  completePendingTwoFactorSignIn,
  hasAnyAdmin,
  refreshAdminSession,
  requireAdmin,
  signInAdmin,
  signOutAdmin
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { ensureDefaultPublicSubdomainForAdmin } from "@/lib/public-subdomain";
import { isAnyRateLimited } from "@/lib/rate-limit";
import { verifyTotpCode } from "@/lib/totp";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export async function loginAction(formData: FormData) {
  const email = formString(formData, "email");
  const password = formString(formData, "password");
  const twoFactorCode = formString(formData, "twoFactorCode");

  if (twoFactorCode && !email && !password) {
    if (await isAnyRateLimited([{ scope: "auth:2fa", limit: 8, windowSeconds: 15 * 60, identifier: "pending" }])) {
      redirect("/admin/login?twoFactor=1&error=rate_limit");
    }

    const result = await completePendingTwoFactorSignIn(twoFactorCode);

    if (result === "success") {
      redirect("/admin/dashboard");
    }

    redirect("/admin/login?twoFactor=1&error=1");
  }

  if (
    await isAnyRateLimited([
      { scope: "auth:login:email", limit: 5, windowSeconds: 15 * 60, identifier: normalizeEmail(email) },
      { scope: "auth:login:ip", limit: 40, windowSeconds: 15 * 60, identifier: "global" }
    ])
  ) {
    redirect("/admin/login?error=rate_limit");
  }

  const result = await signInAdmin(email, password);

  if (result === "pending") {
    redirect("/admin/login?approval=pending");
  }

  if (result === "two_factor_required") {
    redirect("/admin/login?twoFactor=1");
  }

  if (result !== "success") {
    redirect("/admin/login?error=1");
  }

  redirect("/admin/dashboard");
}

export async function registerAdminAction(formData: FormData) {
  const alreadyHasAdmin = await hasAnyAdmin();

  const name = formString(formData, "name");
  const email = formString(formData, "email").toLowerCase();
  const password = formString(formData, "password");
  const confirmPassword = formString(formData, "confirmPassword");

  if (!name || !email || !password || password.length < 8) {
    redirect("/admin/register?error=missing");
  }

  if (password !== confirmPassword) {
    redirect("/admin/register?error=password");
  }

  const passwordHash = await hashPassword(password);

  const createdAdmin = await prisma.admin.create({
    data: {
      name,
      email,
      passwordHash,
      role: alreadyHasAdmin ? "photographer" : "super_admin",
      status: alreadyHasAdmin ? "pending" : "approved",
      approvedAt: alreadyHasAdmin ? null : new Date()
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });

  await ensureDefaultPublicSubdomainForAdmin(createdAdmin);

  if (alreadyHasAdmin) {
    redirect("/admin/login?registered=pending");
  }

  await signInAdmin(email, password);
  redirect("/admin/dashboard");
}

export async function logoutAction() {
  await signOutAdmin();
  redirect("/admin/login");
}

export async function refreshAdminSessionAction() {
  const admin = await refreshAdminSession();
  return { ok: Boolean(admin) };
}

export async function enableTwoFactorAction(formData: FormData) {
  const admin = await requireAdmin();
  const secret = formString(formData, "secret").replace(/\s/g, "").toUpperCase();
  const code = formString(formData, "code");

  if (!secret || !verifyTotpCode(secret, code)) {
    redirect("/admin/settings?tab=security&error=code");
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: secret
    }
  });

  redirect("/admin/settings?tab=security&enabled=1");
}

export async function disableTwoFactorAction(formData: FormData) {
  const adminSession = await requireAdmin();
  const password = formString(formData, "password");

  const admin = await prisma.admin.findUnique({
    where: { id: adminSession.id },
    select: { passwordHash: true }
  });

  if (!admin || !password || !(await verifyPassword(password, admin.passwordHash))) {
    redirect("/admin/settings?tab=security&error=password");
  }

  await prisma.admin.update({
    where: { id: adminSession.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null
    }
  });

  redirect("/admin/settings?tab=security&disabled=1");
}
