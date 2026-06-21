import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { verifyTotpCode } from "@/lib/totp";

const ADMIN_COOKIE = "wgm_admin";
const SESSION_MAX_AGE = 60 * 60 * 24 * 14;

function authSecret() {
  return process.env.AUTH_SECRET ?? "dev-auth-secret-change-me";
}

function signValue(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("hex");
}

function createSessionValue(adminId: string) {
  return `${adminId}.${signValue(adminId)}`;
}

function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE
  };
}

function readSessionValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  const [adminId, signature] = value.split(".");

  if (!adminId || !signature) {
    return null;
  }

  const expectedSignature = signValue(adminId);
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  return adminId;
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const adminId = readSessionValue(cookieStore.get(ADMIN_COOKIE)?.value);

  if (!adminId) {
    return null;
  }

  return prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, name: true, role: true, status: true }
  });
}

export async function refreshAdminSession() {
  const cookieStore = await cookies();
  const adminId = readSessionValue(cookieStore.get(ADMIN_COOKIE)?.value);

  if (!adminId) {
    return null;
  }

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, name: true, role: true, status: true }
  });

  if (!admin || admin.status !== "approved") {
    return null;
  }

  cookieStore.set(ADMIN_COOKIE, createSessionValue(admin.id), adminSessionCookieOptions());

  return admin;
}

export async function requireAdmin() {
  const admin = await getAdminSession();

  if (!admin) {
    redirect("/admin/login");
  }

  if (admin.status !== "approved") {
    redirect("/admin/login?approval=pending");
  }

  return admin;
}

export async function requireSuperAdmin() {
  const admin = await requireAdmin();

  if (admin.role !== "super_admin") {
    redirect("/admin/dashboard");
  }

  return admin;
}

export async function hasAnyAdmin() {
  const count = await prisma.admin.count();
  return count > 0;
}

export async function signInAdmin(email: string, password: string, twoFactorCode?: string) {
  const admin = await prisma.admin.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!admin) {
    return "invalid";
  }

  const isValidPassword = await verifyPassword(password, admin.passwordHash);

  if (!isValidPassword) {
    return "invalid";
  }

  if (admin.status !== "approved") {
    return "pending";
  }

  if (admin.twoFactorEnabled) {
    if (!admin.twoFactorSecret || !twoFactorCode || !verifyTotpCode(admin.twoFactorSecret, twoFactorCode)) {
      return "invalid";
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, createSessionValue(admin.id), adminSessionCookieOptions());

  return "success";
}

export async function signOutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}
