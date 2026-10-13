import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ACTIONABLE_EVENT_TYPES = new Set([
  "email.bounced",
  "email.complained",
  "email.delivery_delayed",
  "email.failed",
  "email.suppressed"
]);

const CLEAR_ERROR_EVENT_TYPES = new Set([
  "email.clicked",
  "email.delivered",
  "email.opened",
  "email.sent"
]);

type ResendWebhookData = {
  email_id: string;
  from?: string;
  to?: string[];
  subject?: string;
  bounce?: { message?: string; type?: string; subType?: string };
  failed?: { reason?: string };
  suppressed?: { reason?: string };
} & Record<string, unknown>;

export type ResendWebhookPayload = {
  type: string;
  created_at: string;
  data: ResendWebhookData;
} & Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
}

function nestedString(record: Record<string, unknown>, objectKey: string, valueKey: string) {
  const nested = record[objectKey];
  return isRecord(nested) ? stringValue(nested[valueKey]) : null;
}

export function parseResendWebhookPayload(value: unknown): ResendWebhookPayload {
  if (!isRecord(value) || !isRecord(value.data)) {
    throw new Error("Invalid Resend webhook payload.");
  }

  const type = stringValue(value.type);
  const createdAt = stringValue(value.created_at);
  const emailId = stringValue(value.data.email_id);

  if (!type?.startsWith("email.") || !createdAt || !emailId) {
    throw new Error("Invalid Resend e-mail webhook payload.");
  }

  const occurredAt = new Date(createdAt);
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error("Invalid Resend webhook timestamp.");
  }

  return {
    ...value,
    type,
    created_at: occurredAt.toISOString(),
    data: {
      ...value.data,
      email_id: emailId,
      from: stringValue(value.data.from) ?? undefined,
      to: stringArray(value.data.to),
      subject: stringValue(value.data.subject) ?? undefined,
      bounce: isRecord(value.data.bounce)
        ? {
            message: stringValue(value.data.bounce.message) ?? undefined,
            type: stringValue(value.data.bounce.type) ?? undefined,
            subType: stringValue(value.data.bounce.subType) ?? undefined
          }
        : undefined,
      failed: isRecord(value.data.failed)
        ? { reason: stringValue(value.data.failed.reason) ?? undefined }
        : undefined,
      suppressed: isRecord(value.data.suppressed)
        ? { reason: stringValue(value.data.suppressed.reason) ?? undefined }
        : undefined
    }
  };
}

function statusFromEventType(type: string) {
  return type.startsWith("email.") ? type.slice("email.".length) : type;
}

function eventErrorMessage(payload: ResendWebhookPayload) {
  const data = payload.data as ResendWebhookData & Record<string, unknown>;
  const explicit =
    payload.data.bounce?.message ||
    payload.data.failed?.reason ||
    payload.data.suppressed?.reason ||
    nestedString(data, "delivery_delayed", "reason");

  if (explicit) {
    return explicit.slice(0, 2000);
  }

  if (payload.type === "email.delivery_delayed") {
    return "A címzett levelezőszervere ideiglenesen késlelteti a kézbesítést.";
  }

  if (payload.type === "email.complained") {
    return "A címzett spamként jelentette a levelet.";
  }

  if (payload.type === "email.suppressed") {
    return "A Resend letiltotta a kézbesítést ehhez a címzetthez.";
  }

  return null;
}

function metadataString(metadata: Prisma.JsonValue | null, key: string) {
  if (!isRecord(metadata)) {
    return null;
  }

  return stringValue(metadata[key]);
}

function notificationTitle(type: string) {
  if (type === "email.delivery_delayed") return "Foglalási e-mail kézbesítése késik";
  if (type === "email.bounced") return "Foglalási e-mail visszapattant";
  if (type === "email.complained") return "A foglalási e-mailt spamként jelentették";
  if (type === "email.suppressed") return "Foglalási e-mail kézbesítése letiltva";
  return "Foglalási e-mail küldése sikertelen";
}

export async function recordResendWebhookEvent(input: {
  webhookId: string;
  payload: ResendWebhookPayload;
}) {
  const occurredAt = new Date(input.payload.created_at);
  const providerMessageId = input.payload.data.email_id;
  const status = statusFromEventType(input.payload.type);
  const errorMessage = eventErrorMessage(input.payload);

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.resendWebhookEvent.create({
        data: {
          webhookId: input.webhookId,
          providerMessageId,
          type: input.payload.type,
          occurredAt,
          payload: input.payload as unknown as Prisma.InputJsonValue
        }
      });

      const sentEmail = await tx.sentEmailLog.findUnique({
        where: { providerMessageId },
        select: { lastEventAt: true }
      });
      const shouldApply = !sentEmail?.lastEventAt || occurredAt >= sentEmail.lastEventAt;

      if (sentEmail && shouldApply) {
        await tx.sentEmailLog.update({
          where: { providerMessageId },
          data: {
            status,
            lastEvent: status,
            lastEventAt: occurredAt,
            errorMessage: CLEAR_ERROR_EVENT_TYPES.has(input.payload.type) ? null : errorMessage
          }
        });
      }

      const deliveryLogs = await tx.deliveryLog.findMany({
        where: { providerMessageId },
        select: {
          id: true,
          adminId: true,
          entityType: true,
          recipient: true,
          subject: true,
          metadata: true
        }
      });

      if (shouldApply && deliveryLogs.length > 0) {
        await tx.deliveryLog.updateMany({
          where: { providerMessageId },
          data: {
            status,
            lastError: CLEAR_ERROR_EVENT_TYPES.has(input.payload.type) ? null : errorMessage,
            nextAttemptAt: null
          }
        });
      }

      if (shouldApply && ACTIONABLE_EVENT_TYPES.has(input.payload.type)) {
        for (const log of deliveryLogs) {
          if (log.entityType !== "mini_session_booking") continue;

          const sessionId = metadataString(log.metadata, "sessionId");
          const recipient = log.recipient || input.payload.data.to?.join(", ") || "Ismeretlen címzett";
          const detail = [recipient, log.subject || input.payload.data.subject, errorMessage].filter(Boolean).join(" · ");

          await tx.adminNotification.create({
            data: {
              adminId: log.adminId,
              type: input.payload.type,
              title: notificationTitle(input.payload.type),
              message: detail,
              href: sessionId ? `/admin/mini-sessions/${sessionId}?tab=bookings` : "/admin/settings?tab=logs"
            }
          });
        }
      }

      return {
        duplicate: false,
        matchedEmail: Boolean(sentEmail),
        matchedDeliveries: deliveryLogs.length,
        status
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { duplicate: true, matchedEmail: false, matchedDeliveries: 0, status };
    }

    throw error;
  }
}
