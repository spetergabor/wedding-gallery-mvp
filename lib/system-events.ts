import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SystemEventSeverity = "info" | "success" | "warning" | "error";
export type SystemEventStatus = "started" | "success" | "failed" | "skipped" | "warning";

type LogSystemEventInput = {
  actorAdminId?: string | null;
  targetAdminId?: string | null;
  type: string;
  title: string;
  message?: string | null;
  severity?: SystemEventSeverity;
  status?: SystemEventStatus;
  source?: string | null;
  href?: string | null;
  metadata?: Prisma.InputJsonValue | null;
};

export function systemEventErrorMessage(error: unknown, fallback = "Ismeretlen hiba.") {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function logSystemEvent(input: LogSystemEventInput) {
  try {
    await prisma.systemEvent.create({
      data: {
        actorAdminId: input.actorAdminId ?? null,
        targetAdminId: input.targetAdminId ?? null,
        type: input.type,
        title: input.title,
        message: input.message ?? null,
        severity: input.severity ?? "info",
        status: input.status ?? "success",
        source: input.source ?? null,
        href: input.href ?? null,
        metadata: input.metadata ?? undefined
      }
    });
  } catch (error) {
    console.error("System event log failed", error);
  }
}
