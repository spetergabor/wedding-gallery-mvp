import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { verifyTotpCode } from "@/lib/totp";

const ADMIN_COOKIE = "wgm_admin";
const PENDING_2FA_COOKIE = "wgm_pending_2fa";
const SESSION_MAX_AGE = 60 * 60 * 24 * 14;
const PENDING_2FA_MAX_AGE = 5 * 60;

const ADMIN_SESSION_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  teamMembership: {
    select: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true
        }
      }
    }
  }
} as const;

type RawAdminSession = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  teamMembership: {
    owner: {
      id: string;
      name: string;
      email: string;
      status: string;
    };
  } | null;
};

export type AdminSession = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  workspaceAdminId: string;
  workspaceOwnerName: string | null;
  workspaceOwnerEmail: string | null;
  isTeamMember: boolean;
};

function toAdminSession(admin: RawAdminSession): AdminSession {
  const owner = admin.teamMembership?.owner;
  const activeOwner = owner?.status === "approved" ? owner : null;

  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    status: admin.status,
    workspaceAdminId: activeOwner?.id ?? admin.id,
    workspaceOwnerName: activeOwner?.name ?? null,
    workspaceOwnerEmail: activeOwner?.email ?? null,
    isTeamMember: Boolean(activeOwner)
  };
}

function authSecret() {
  return process.env.AUTH_SECRET ?? "dev-auth-secret-change-me";
}

function signValue(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("hex");
}

function createSessionValue(adminId: string) {
  return `${adminId}.${signValue(adminId)}`;
}

function createPendingTwoFactorValue(adminId: string) {
  const issuedAt = Date.now().toString();
  const payload = `${adminId}.${issuedAt}`;

  return `${payload}.${signValue(payload)}`;
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

function pendingTwoFactorCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/admin/login",
    maxAge: PENDING_2FA_MAX_AGE
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

function readPendingTwoFactorValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  const [adminId, issuedAt, signature] = value.split(".");

  if (!adminId || !issuedAt || !signature) {
    return null;
  }

  const issuedAtMs = Number.parseInt(issuedAt, 10);

  if (!Number.isFinite(issuedAtMs) || Date.now() - issuedAtMs > PENDING_2FA_MAX_AGE * 1000) {
    return null;
  }

  const expectedSignature = signValue(`${adminId}.${issuedAt}`);
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

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: ADMIN_SESSION_SELECT
  });

  return admin ? toAdminSession(admin) : null;
}

export async function refreshAdminSession() {
  const cookieStore = await cookies();
  const adminId = readSessionValue(cookieStore.get(ADMIN_COOKIE)?.value);

  if (!adminId) {
    return null;
  }

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: ADMIN_SESSION_SELECT
  });

  if (!admin || admin.status !== "approved") {
    return null;
  }

  cookieStore.set(ADMIN_COOKIE, createSessionValue(admin.id), adminSessionCookieOptions());

  return toAdminSession(admin);
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

  if (admin.role !== "super_admin" || admin.isTeamMember) {
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
    if (!twoFactorCode) {
      const cookieStore = await cookies();
      cookieStore.set(PENDING_2FA_COOKIE, createPendingTwoFactorValue(admin.id), pendingTwoFactorCookieOptions());

      return "two_factor_required";
    }

    if (!admin.twoFactorSecret || !verifyTotpCode(admin.twoFactorSecret, twoFactorCode)) {
      return "invalid";
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, createSessionValue(admin.id), adminSessionCookieOptions());

  return "success";
}

export async function completePendingTwoFactorSignIn(twoFactorCode: string) {
  const cookieStore = await cookies();
  const adminId = readPendingTwoFactorValue(cookieStore.get(PENDING_2FA_COOKIE)?.value);

  if (!adminId) {
    return "invalid";
  }

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      status: true,
      twoFactorEnabled: true,
      twoFactorSecret: true
    }
  });

  if (!admin || admin.status !== "approved" || !admin.twoFactorEnabled || !admin.twoFactorSecret) {
    cookieStore.delete(PENDING_2FA_COOKIE);
    return "invalid";
  }

  if (!verifyTotpCode(admin.twoFactorSecret, twoFactorCode)) {
    return "invalid";
  }

  cookieStore.delete(PENDING_2FA_COOKIE);
  cookieStore.set(ADMIN_COOKIE, createSessionValue(admin.id), adminSessionCookieOptions());

  return "success";
}

export async function signOutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  cookieStore.delete(PENDING_2FA_COOKIE);
}
