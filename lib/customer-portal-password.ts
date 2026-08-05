import "server-only";

import {
  customerPortalPasswordUrl,
  sendCustomerPortalAccessEmail
} from "@/lib/email";
import {
  PASSWORD_RESET_EXPIRES_MINUTES,
  createPasswordResetToken,
  passwordResetExpiresAt,
  passwordResetTokenHash
} from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

export type CustomerPortalPasswordPurpose = "invite" | "reset";

export async function createCustomerPortalPasswordToken(
  accountId: string,
  purpose: CustomerPortalPasswordPurpose
) {
  const token = createPasswordResetToken();
  const now = new Date();

  await prisma.$transaction([
    prisma.customerPortalPasswordResetToken.updateMany({
      where: { accountId, usedAt: null },
      data: { usedAt: now }
    }),
    prisma.customerPortalPasswordResetToken.create({
      data: {
        accountId,
        tokenHash: passwordResetTokenHash(token),
        purpose,
        expiresAt: passwordResetExpiresAt()
      }
    })
  ]);

  return token;
}

export async function sendCustomerPortalPasswordEmail(
  accountId: string,
  purpose: CustomerPortalPasswordPurpose
) {
  const account = await prisma.customerPortalAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      email: true,
      loginIdentifier: true,
      status: true,
      customer: {
        select: {
          coupleName: true,
          preferredLanguage: true,
          admin: {
            select: {
              siteSettings: { select: { publicSubdomain: true } }
            }
          }
        }
      }
    }
  });

  if (!account || account.status !== "active" || !account.email) {
    return { sent: false as const, reason: "missing-email" as const };
  }

  const token = await createCustomerPortalPasswordToken(account.id, purpose);
  const actionUrl = customerPortalPasswordUrl(
    token,
    account.customer.admin.siteSettings?.publicSubdomain
  );

  try {
    const sent = await sendCustomerPortalAccessEmail({
      to: account.email,
      coupleName: account.customer.coupleName,
      loginIdentifier: account.loginIdentifier,
      actionUrl,
      expiresInMinutes: PASSWORD_RESET_EXPIRES_MINUTES,
      purpose,
      language: account.customer.preferredLanguage === "hu" ? "hu" : "de"
    });

    return sent
      ? { sent: true as const }
      : { sent: false as const, reason: "email-unavailable" as const };
  } catch (error) {
    console.error("Customer portal access email failed", error);
    return { sent: false as const, reason: "email-failed" as const };
  }
}

export async function cleanupCustomerPortalPasswordTokens(now = new Date()) {
  const usedBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const result = await prisma.customerPortalPasswordResetToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { usedAt: { not: null }, createdAt: { lt: usedBefore } }
      ]
    }
  });

  return { deleted: result.count };
}
