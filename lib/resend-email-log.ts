import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ResendSentEmailSummary = {
  id: string;
  to: string[];
  from: string;
  createdAt: string;
  subject: string;
  bcc: string[];
  cc: string[];
  replyTo: string[];
  lastEvent: string;
  scheduledAt: string | null;
};

export type ResendSentEmailDetail = ResendSentEmailSummary & {
  html: string | null;
  text: string | null;
  tags: Array<{ name: string; value: string }>;
};

export type ResendSentEmailListResult = {
  emails: ResendSentEmailSummary[];
  hasMore: boolean;
  configured: boolean;
  error: string | null;
};

export type SentEmailLogInput = {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
  subject: string;
  html?: string | null;
  text?: string | null;
  providerMessageId?: string | null;
  status: "sent" | "failed";
  errorMessage?: string | null;
};

function jsonAddressList(value: Prisma.JsonValue | null) {
  if (typeof value === "string") {
    return [value];
  }

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function publicEmailId(email: { id: string; providerMessageId: string | null }) {
  return email.providerMessageId || email.id;
}

function cleanErrorMessage(value: string | null | undefined) {
  return value?.trim().slice(0, 2000) || null;
}

export async function storeSentEmailLog(input: SentEmailLogInput) {
  try {
    await prisma.sentEmailLog.create({
      data: {
        provider: "resend",
        providerMessageId: input.providerMessageId ?? null,
        status: input.status,
        from: input.from,
        to: input.to,
        cc: input.cc?.length ? input.cc : undefined,
        bcc: input.bcc?.length ? input.bcc : undefined,
        replyTo: input.replyTo?.length ? input.replyTo : undefined,
        subject: input.subject,
        html: input.html ?? null,
        text: input.text ?? null,
        lastEvent: input.status,
        errorMessage: cleanErrorMessage(input.errorMessage),
        sentAt: input.status === "sent" ? new Date() : null
      }
    });
  } catch (error) {
    // An e-mail must not fail merely because its audit record could not be stored.
    console.error("Sent e-mail log could not be stored", error);
  }
}

export async function listResendSentEmails(limit = 50): Promise<ResendSentEmailListResult> {
  const safeLimit = Math.min(100, Math.max(1, Math.round(limit)));

  try {
    const rows = await prisma.sentEmailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: safeLimit + 1,
      select: {
        id: true,
        providerMessageId: true,
        from: true,
        to: true,
        cc: true,
        bcc: true,
        replyTo: true,
        subject: true,
        lastEvent: true,
        createdAt: true
      }
    });
    const hasMore = rows.length > safeLimit;

    return {
      emails: rows.slice(0, safeLimit).map((email) => ({
        id: publicEmailId(email),
        to: jsonAddressList(email.to),
        from: email.from,
        createdAt: email.createdAt.toISOString(),
        subject: email.subject,
        bcc: jsonAddressList(email.bcc),
        cc: jsonAddressList(email.cc),
        replyTo: jsonAddressList(email.replyTo),
        lastEvent: email.lastEvent,
        scheduledAt: null
      })),
      hasMore,
      configured: true,
      error: null
    };
  } catch (error) {
    return {
      emails: [],
      hasMore: false,
      configured: true,
      error: error instanceof Error ? error.message : "The sent e-mail log could not be loaded."
    };
  }
}

export async function getResendSentEmail(emailId: string) {
  try {
    const email = await prisma.sentEmailLog.findFirst({
      where: {
        OR: [{ id: emailId }, { providerMessageId: emailId }]
      },
      select: {
        id: true,
        providerMessageId: true,
        from: true,
        to: true,
        cc: true,
        bcc: true,
        replyTo: true,
        subject: true,
        html: true,
        text: true,
        lastEvent: true,
        errorMessage: true,
        createdAt: true
      }
    });

    if (!email) {
      return { email: null, configured: true, error: "The sent e-mail was not found." };
    }

    const detail: ResendSentEmailDetail = {
      id: publicEmailId(email),
      to: jsonAddressList(email.to),
      from: email.from,
      createdAt: email.createdAt.toISOString(),
      subject: email.subject,
      bcc: jsonAddressList(email.bcc),
      cc: jsonAddressList(email.cc),
      replyTo: jsonAddressList(email.replyTo),
      lastEvent: email.lastEvent,
      scheduledAt: null,
      html: email.html,
      text: email.text,
      tags: email.errorMessage ? [{ name: "error", value: email.errorMessage }] : []
    };

    return { email: detail, configured: true, error: null };
  } catch (error) {
    return {
      email: null,
      configured: true,
      error: error instanceof Error ? error.message : "The sent e-mail could not be loaded."
    };
  }
}
