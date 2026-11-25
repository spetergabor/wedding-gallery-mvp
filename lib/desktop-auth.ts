import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { verifyTotpCode } from "@/lib/totp";

const TOKEN_VERSION = "v1";
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

type DesktopTokenPayload = {
  sub: string;
  email: string;
  name: string;
  role: "super_admin";
  iat: number;
  exp: number;
};

function signingSecret() {
  const value = process.env.DESKTOP_AUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!value || (process.env.NODE_ENV === "production" && value === "dev-auth-secret-change-me")) {
    throw new Error("Desktop authentication is not configured.");
  }
  return value;
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

function safeSignatureEqual(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function createDesktopAccessToken(admin: { id: string; email: string; name: string }) {
  const issuedAt = Math.floor(Date.now() / 1_000);
  const payload: DesktopTokenPayload = {
    sub: admin.id,
    email: admin.email,
    name: admin.name,
    role: "super_admin",
    iat: issuedAt,
    exp: issuedAt + TOKEN_MAX_AGE_SECONDS
  };
  const encodedPayload = encode(JSON.stringify(payload));
  const unsigned = `${TOKEN_VERSION}.${encodedPayload}`;
  return {
    token: `${unsigned}.${sign(unsigned)}`,
    expiresAt: new Date(payload.exp * 1_000).toISOString()
  };
}

export async function verifyDesktopAccessToken(token: string | null | undefined) {
  if (!token) return null;
  const [version, encodedPayload, signature] = token.split(".");
  if (version !== TOKEN_VERSION || !encodedPayload || !signature) return null;

  const unsigned = `${version}.${encodedPayload}`;
  if (!safeSignatureEqual(sign(unsigned), signature)) return null;

  let payload: DesktopTokenPayload;
  try {
    payload = JSON.parse(decode(encodedPayload)) as DesktopTokenPayload;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1_000);
  if (!payload.sub || payload.role !== "super_admin" || payload.exp <= now || payload.iat > now + 60) return null;

  const admin = await prisma.admin.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      teamMembership: { select: { id: true } }
    }
  });

  if (!admin || admin.status !== "approved" || admin.role !== "super_admin" || admin.teamMembership) return null;
  return admin;
}

export async function getDesktopAccessSession() {
  const headerStore = await headers();
  const authorization = headerStore.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return verifyDesktopAccessToken(match?.[1]);
}

export async function authenticateDesktopAdmin(email: string, password: string, twoFactorCode?: string) {
  const admin = await prisma.admin.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      passwordHash: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      teamMembership: { select: { id: true } }
    }
  });

  if (!admin || !(await verifyPassword(password, admin.passwordHash))) return { status: "invalid" as const };
  if (admin.status !== "approved") return { status: "pending" as const };
  if (admin.role !== "super_admin" || admin.teamMembership) return { status: "forbidden" as const };
  if (admin.twoFactorEnabled && !twoFactorCode) return { status: "two_factor_required" as const };
  if (admin.twoFactorEnabled && (!admin.twoFactorSecret || !verifyTotpCode(admin.twoFactorSecret, twoFactorCode ?? ""))) {
    return { status: "invalid" as const };
  }

  return {
    status: "success" as const,
    admin: { id: admin.id, email: admin.email, name: admin.name }
  };
}
