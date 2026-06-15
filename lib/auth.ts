import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

const ADMIN_COOKIE = "wgm_admin";
const SESSION_MAX_AGE = 60 * 60 * 8;

function authSecret() {
  return process.env.AUTH_SECRET ?? "dev-auth-secret-change-me";
}

function signValue(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("hex");
}

function createSessionValue(adminId: string) {
  return `${adminId}.${signValue(adminId)}`;
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
    select: { id: true, email: true, name: true }
  });
}

export async function requireAdmin() {
  const admin = await getAdminSession();

  if (!admin) {
    redirect("/admin/login");
  }

  return admin;
}

export async function hasAnyAdmin() {
  const count = await prisma.admin.count();
  return count > 0;
}

export async function signInAdmin(email: string, password: string) {
  const admin = await prisma.admin.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!admin) {
    return false;
  }

  const isValidPassword = await verifyPassword(password, admin.passwordHash);

  if (!isValidPassword) {
    return false;
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, createSessionValue(admin.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });

  return true;
}

export async function signOutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}
