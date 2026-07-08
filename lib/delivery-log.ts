import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DELIVERY_CHANNEL_EMAIL = "email";
export const DELIVERY_CHANNEL_GOOGLE_CALENDAR = "google_calendar";

export const DELIVERY_STATUS_PENDING = "pending";
export const DELIVERY_STATUS_SENT = "sent";
export const DELIVERY_STATUS_FAILED = "failed";
export const DELIVERY_STATUS_RETRY = "retry";
export const DELIVERY_STATUS_SKIPPED = "skipped";

export type DeliveryChannel = typeof DELIVERY_CHANNEL_EMAIL | typeof DELIVERY_CHANNEL_GOOGLE_CALENDAR;
export type DeliveryStatus =
  | typeof DELIVERY_STATUS_PENDING
  | typeof DELIVERY_STATUS_SENT
  | typeof DELIVERY_STATUS_FAILED
  | typeof DELIVERY_STATUS_RETRY
  | typeof DELIVERY_STATUS_SKIPPED;

type DeliverySendResult =
  | boolean
  | {
      ok?: boolean;
      skipped?: boolean;
      providerMessageId?: string | null;
      errorMessage?: string | null;
    };

type DeliveryLogInput = {
  adminId: string;
  channel: DeliveryChannel;
  type: string;
  recipient?: string | null;
  subject?: string | null;
  provider?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  maxAttempts?: number;
  metadata?: Prisma.InputJsonValue | null;
};

type RunLoggedDeliveryInput = DeliveryLogInput & {
  send: () => Promise<DeliverySendResult>;
};

function cleanErrorMessage(error: unknown, fallback = "Ismeretlen kézbesítési hiba.") {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : fallback;

  return message.slice(0, 1000);
}

function nextRetryAt(attemptCount: number) {
  const minutes = Math.min(60, Math.max(5, attemptCount * 10));
  return new Date(Date.now() + minutes * 60_000);
}

function normalizeSendResult(result: DeliverySendResult) {
  if (typeof result === "boolean") {
    return result
      ? { ok: true, skipped: false, providerMessageId: null, errorMessage: null }
      : {
          ok: false,
          skipped: false,
          providerMessageId: null,
          errorMessage: "A szolgáltató nem igazolta vissza a küldést."
        };
  }

  return {
    ok: result.ok !== false && !result.skipped,
    skipped: Boolean(result.skipped),
    providerMessageId: result.providerMessageId ?? null,
    errorMessage: result.errorMessage ?? null
  };
}

export async function createDeliveryLog(input: DeliveryLogInput) {
  return prisma.deliveryLog.create({
    data: {
      adminId: input.adminId,
      channel: input.channel,
      type: input.type,
      status: DELIVERY_STATUS_PENDING,
      recipient: input.recipient ?? null,
      subject: input.subject ?? null,
      provider: input.provider ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      maxAttempts: input.maxAttempts ?? 3,
      metadata: input.metadata ?? undefined
    }
  });
}

export async function markDeliveryLogSent(id: string, providerMessageId?: string | null) {
  return prisma.deliveryLog.update({
    where: { id },
    data: {
      status: DELIVERY_STATUS_SENT,
      providerMessageId: providerMessageId ?? null,
      lastError: null,
      nextAttemptAt: null,
      sentAt: new Date(),
      attemptCount: { increment: 1 }
    }
  });
}

export async function markDeliveryLogSkipped(id: string, message?: string | null) {
  return prisma.deliveryLog.update({
    where: { id },
    data: {
      status: DELIVERY_STATUS_SKIPPED,
      lastError: message ?? null,
      nextAttemptAt: null,
      attemptCount: { increment: 1 }
    }
  });
}

export async function markDeliveryLogFailed(id: string, error: unknown) {
  const current = await prisma.deliveryLog.findUnique({
    where: { id },
    select: { attemptCount: true, maxAttempts: true }
  });

  const attemptCount = (current?.attemptCount ?? 0) + 1;
  const maxAttempts = current?.maxAttempts ?? 3;
  const canRetry = attemptCount < maxAttempts;

  return prisma.deliveryLog.update({
    where: { id },
    data: {
      status: canRetry ? DELIVERY_STATUS_RETRY : DELIVERY_STATUS_FAILED,
      lastError: cleanErrorMessage(error),
      nextAttemptAt: canRetry ? nextRetryAt(attemptCount) : null,
      attemptCount
    }
  });
}

export async function runLoggedDelivery(input: RunLoggedDeliveryInput) {
  const log = await createDeliveryLog(input);

  try {
    const result = normalizeSendResult(await input.send());

    if (result.skipped) {
      const updated = await markDeliveryLogSkipped(log.id, result.errorMessage);
      return { ok: false, status: updated.status as DeliveryStatus, log: updated, errorMessage: result.errorMessage ?? null };
    }

    if (!result.ok) {
      const updated = await markDeliveryLogFailed(log.id, result.errorMessage ?? "Kézbesítési hiba.");
      return { ok: false, status: updated.status as DeliveryStatus, log: updated, errorMessage: updated.lastError };
    }

    const updated = await markDeliveryLogSent(log.id, result.providerMessageId);
    return { ok: true, status: updated.status as DeliveryStatus, log: updated, errorMessage: null };
  } catch (error) {
    const updated = await markDeliveryLogFailed(log.id, error);
    return { ok: false, status: updated.status as DeliveryStatus, log: updated, errorMessage: updated.lastError };
  }
}
