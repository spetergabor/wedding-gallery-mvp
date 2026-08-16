import { prisma } from "@/lib/prisma";

const RESEND_API_BASE = "https://api.resend.com";
const RESEND_USER_AGENT = "Spetly/1.0";
const IMPORT_PAGE_SIZE = 20;
const DETAIL_CONCURRENCY = 1;
const REQUEST_INTERVAL_MS = 200;
const MAX_RATE_LIMIT_RETRIES = 4;

type ResendEmailRecord = {
  id: string;
  to: string[];
  from: string;
  createdAt: Date;
  subject: string;
  html: string | null;
  text: string | null;
  bcc: string[];
  cc: string[];
  replyTo: string[];
  lastEvent: string;
};

type ResendListResponse = {
  data?: unknown;
  has_more?: unknown;
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function stringArray(value: unknown) {
  if (typeof value === "string") {
    return [value];
  }

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function dateValue(value: unknown) {
  const parsed = new Date(stringValue(value));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizeEmail(value: unknown): ResendEmailRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = stringValue(record.id);

  if (!id) {
    return null;
  }

  return {
    id,
    to: stringArray(record.to),
    from: stringValue(record.from),
    createdAt: dateValue(record.created_at),
    subject: stringValue(record.subject),
    html: nullableString(record.html),
    text: nullableString(record.text),
    bcc: stringArray(record.bcc),
    cc: stringArray(record.cc),
    replyTo: stringArray(record.reply_to),
    lastEvent: stringValue(record.last_event, "sent")
  };
}

function providerErrorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = stringValue((payload as Record<string, unknown>).message);
    if (message) {
      return message;
    }
  }

  return `Resend request failed (${status}).`;
}

function retryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.max(REQUEST_INTERVAL_MS, Math.ceil(seconds * 1000));
    }
  }

  return Math.max(REQUEST_INTERVAL_MS, 500 * 2 ** attempt);
}

async function resendGet(path: string, apiKey: string) {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetch(`${RESEND_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": RESEND_USER_AGENT
      },
      cache: "no-store"
    });
    const payload: unknown = await response.json().catch(() => null);

    if (response.ok) {
      await new Promise((resolve) => setTimeout(resolve, REQUEST_INTERVAL_MS));
      return payload;
    }

    if (response.status !== 429 || attempt === MAX_RATE_LIMIT_RETRIES) {
      throw new Error(providerErrorMessage(payload, response.status));
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelayMs(response, attempt)));
  }

  throw new Error("Resend request retry limit exceeded.");
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;

      try {
        results[index] = { status: "fulfilled", value: await task(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function importedStatus(lastEvent: string) {
  return ["failed", "bounced", "complained", "canceled"].includes(lastEvent) ? "failed" : "sent";
}

async function saveImportedEmail(email: ResendEmailRecord) {
  const data = {
    provider: "resend",
    status: importedStatus(email.lastEvent),
    from: email.from,
    to: email.to,
    cc: email.cc.length ? email.cc : undefined,
    bcc: email.bcc.length ? email.bcc : undefined,
    replyTo: email.replyTo.length ? email.replyTo : undefined,
    subject: email.subject,
    html: email.html,
    text: email.text,
    lastEvent: email.lastEvent,
    errorMessage: null,
    sentAt: email.createdAt,
    createdAt: email.createdAt
  };

  await prisma.sentEmailLog.upsert({
    where: { providerMessageId: email.id },
    create: {
      providerMessageId: email.id,
      ...data
    },
    update: data
  });
}

export async function importResendEmailHistoryPage(cursor?: string | null) {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const query = new URLSearchParams({ limit: String(IMPORT_PAGE_SIZE) });
  if (cursor) {
    query.set("after", cursor);
  }

  const listPayload = await resendGet(`/emails?${query.toString()}`, apiKey);
  const list = listPayload && typeof listPayload === "object" ? (listPayload as ResendListResponse) : {};
  const summaries = Array.isArray(list.data)
    ? list.data.flatMap((value) => {
        const email = normalizeEmail(value);
        return email ? [email] : [];
      })
    : [];
  const results = await mapWithConcurrency(summaries, DETAIL_CONCURRENCY, async (summary) => {
    const detail = normalizeEmail(await resendGet(`/emails/${encodeURIComponent(summary.id)}`, apiKey));
    if (!detail) {
      throw new Error(`Invalid Resend e-mail response: ${summary.id}`);
    }
    await saveImportedEmail(detail);
    return detail.id;
  });
  const imported = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - imported;
  const nextCursor = summaries.at(-1)?.id ?? null;
  const hasMore = list.has_more === true && Boolean(nextCursor);

  return {
    imported,
    failed,
    processed: summaries.length,
    hasMore,
    nextCursor
  };
}
