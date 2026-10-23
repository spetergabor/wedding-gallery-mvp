import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const EMAIL_HEALTH_HISTORY_LIMIT = 50;

export type EmailHealthIncident = {
  id: string;
  code: string;
  message: string;
  subject: string | null;
  recipient: string | null;
  occurredAt: string;
  consecutiveFailures: number;
};

export type EmailHealthStatus = {
  healthy: boolean;
  checkedAt: string;
  incident: EmailHealthIncident | null;
};

function jsonAddressList(value: Prisma.JsonValue) {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function errorCode(message: string | null) {
  if (!message) return "RESEND_ERROR";
  if (/NETWORK_ERROR/i.test(message)) return "NETWORK_ERROR";

  const httpCode = message.match(/\bHTTP\s+(\d{3})\b/i)?.[1] ?? message.match(/\bstatusCode["'\s:=]+(\d{3})\b/i)?.[1];
  return httpCode ? `HTTP ${httpCode}` : "RESEND_ERROR";
}

export async function getEmailHealthStatus(): Promise<EmailHealthStatus> {
  const checkedAt = new Date().toISOString();

  if (!process.env.RESEND_API_KEY?.trim()) {
    return {
      healthy: false,
      checkedAt,
      incident: {
        id: "resend-api-key-missing",
        code: "CONFIG_MISSING",
        message: "A RESEND_API_KEY nincs beállítva. Az e-mail-küldés jelenleg nem működik.",
        subject: null,
        recipient: null,
        occurredAt: checkedAt,
        consecutiveFailures: 0
      }
    };
  }

  const emails = await prisma.sentEmailLog.findMany({
    where: { provider: "resend" },
    orderBy: { createdAt: "desc" },
    take: EMAIL_HEALTH_HISTORY_LIMIT,
    select: {
      id: true,
      status: true,
      to: true,
      subject: true,
      errorMessage: true,
      createdAt: true
    }
  });
  const latest = emails[0];

  // A successful API acceptance after an incident proves that the provider is
  // reachable again. Recipient-level bounce/suppression events are handled by
  // the delivery notifications and do not mean that Resend itself is down.
  if (!latest || latest.status !== "failed") {
    return { healthy: true, checkedAt, incident: null };
  }

  let consecutiveFailures = 0;
  for (const email of emails) {
    if (email.status !== "failed") break;
    consecutiveFailures += 1;
  }

  return {
    healthy: false,
    checkedAt,
    incident: {
      id: latest.id,
      code: errorCode(latest.errorMessage),
      message: latest.errorMessage || "A Resend nem igazolta vissza az e-mail küldését.",
      subject: latest.subject || null,
      recipient: jsonAddressList(latest.to).join(", ") || null,
      occurredAt: latest.createdAt.toISOString(),
      consecutiveFailures
    }
  };
}
