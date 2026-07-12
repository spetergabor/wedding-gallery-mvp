"use server";

import { redirect } from "next/navigation";
import { adminPasswordResetUrl, sendAdminPasswordResetEmail } from "@/lib/email";
import {
  PASSWORD_RESET_EXPIRES_MINUTES,
  createPasswordResetToken,
  passwordResetExpiresAt,
  passwordResetTokenHash
} from "@/lib/password-reset";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { isAnyRateLimited } from "@/lib/rate-limit";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resetPasswordPath(token: string, error: string) {
  return `/admin/reset-password/${encodeURIComponent(token)}?error=${error}`;
}

export async function requestAdminPasswordResetAction(formData: FormData) {
  const email = normalizeEmail(formString(formData, "email"));

  if (!isValidEmail(email)) {
    redirect("/admin/forgot-password?sent=1");
  }

  if (
    await isAnyRateLimited([
      { scope: "auth:password-reset-request:email", limit: 3, windowSeconds: 60 * 60, identifier: email },
      { scope: "auth:password-reset-request:ip", limit: 20, windowSeconds: 60 * 60, identifier: "global" }
    ])
  ) {
    redirect("/admin/forgot-password?error=rate_limit");
  }

  const admin = await prisma.admin.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true
    }
  });

  if (admin) {
    const token = createPasswordResetToken();
    const now = new Date();

    await prisma.$transaction([
      prisma.adminPasswordResetToken.updateMany({
        where: {
          adminId: admin.id,
          usedAt: null
        },
        data: { usedAt: now }
      }),
      prisma.adminPasswordResetToken.create({
        data: {
          adminId: admin.id,
          tokenHash: passwordResetTokenHash(token),
          expiresAt: passwordResetExpiresAt()
        }
      })
    ]);

    try {
      await sendAdminPasswordResetEmail({
        to: admin.email,
        name: admin.name,
        resetUrl: adminPasswordResetUrl(token),
        expiresInMinutes: PASSWORD_RESET_EXPIRES_MINUTES
      });
    } catch (error) {
      console.error("Password reset email failed", error);
    }
  }

  redirect("/admin/forgot-password?sent=1");
}

export async function resetAdminPasswordAction(formData: FormData) {
  const token = formString(formData, "token");
  const password = formString(formData, "password");
  const confirmPassword = formString(formData, "confirmPassword");

  if (!token) {
    redirect("/admin/forgot-password?error=invalid");
  }

  if (await isAnyRateLimited([{ scope: "auth:password-reset-submit", limit: 8, windowSeconds: 15 * 60, identifier: token.slice(0, 80) }])) {
    redirect(resetPasswordPath(token, "rate_limit"));
  }

  if (!password || password.length < 8) {
    redirect(resetPasswordPath(token, "missing"));
  }

  if (password !== confirmPassword) {
    redirect(resetPasswordPath(token, "password"));
  }

  const now = new Date();
  const resetToken = await prisma.adminPasswordResetToken.findUnique({
    where: { tokenHash: passwordResetTokenHash(token) },
    select: {
      id: true,
      adminId: true,
      expiresAt: true,
      usedAt: true
    }
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
    redirect(resetPasswordPath(token, "invalid"));
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.admin.update({
      where: { id: resetToken.adminId },
      data: { passwordHash }
    }),
    prisma.adminPasswordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: now }
    }),
    prisma.adminPasswordResetToken.updateMany({
      where: {
        adminId: resetToken.adminId,
        id: { not: resetToken.id },
        usedAt: null
      },
      data: { usedAt: now }
    })
  ]);

  redirect("/admin/login?reset=success");
}
