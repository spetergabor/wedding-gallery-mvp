import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const CUSTOMER_PORTAL_COOKIE = "spetly_customer_portal";
const CUSTOMER_PORTAL_SESSION_DAYS = 30;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    expires: expiresAt
  };
}

export function normalizeCustomerLoginIdentifier(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "").slice(0, 160);
}

export function isValidCustomerLoginIdentifier(value: string) {
  if (value.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  return /^[a-z0-9._-]{3,80}$/.test(value);
}

export async function createCustomerPortalSession(accountId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CUSTOMER_PORTAL_SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.customerPortalSession.deleteMany({
      where: { accountId, expiresAt: { lte: new Date() } }
    }),
    prisma.customerPortalSession.create({
      data: {
        accountId,
        tokenHash: hashSessionToken(token),
        expiresAt
      }
    }),
    prisma.customerPortalAccount.update({
      where: { id: accountId },
      data: { lastLoginAt: new Date() }
    })
  ]);

  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_PORTAL_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function getCustomerPortalSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_PORTAL_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.customerPortalSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      account: {
        select: {
          id: true,
          loginIdentifier: true,
          email: true,
          displayName: true,
          status: true,
          mustChangePassword: true,
          customer: {
            select: {
              id: true,
              adminId: true,
              customerType: true,
              coupleName: true,
              preferredLanguage: true
            }
          }
        }
      }
    }
  });

  if (
    !session ||
    session.expiresAt <= new Date() ||
    session.account.status !== "active" ||
    session.account.customer.customerType !== "wedding_couple"
  ) {
    return null;
  }

  return session;
}

export async function requireCustomerPortalSession(options: { allowPasswordChange?: boolean } = {}) {
  const session = await getCustomerPortalSession();

  if (!session) {
    redirect("/portal/login");
  }

  if (session.account.mustChangePassword && !options.allowPasswordChange) {
    redirect("/portal/account/password");
  }

  return session;
}

export async function deleteCurrentCustomerPortalSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_PORTAL_COOKIE)?.value;

  if (token) {
    await prisma.customerPortalSession.deleteMany({
      where: { tokenHash: hashSessionToken(token) }
    });
  }

  cookieStore.delete(CUSTOMER_PORTAL_COOKIE);
}
