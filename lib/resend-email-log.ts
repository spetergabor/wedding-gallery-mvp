const RESEND_API_BASE = "https://api.resend.com";
const RESEND_USER_AGENT = "Spetly/1.0";

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

type ResendApiEmail = {
  id?: unknown;
  to?: unknown;
  from?: unknown;
  created_at?: unknown;
  subject?: unknown;
  html?: unknown;
  text?: unknown;
  bcc?: unknown;
  cc?: unknown;
  reply_to?: unknown;
  last_event?: unknown;
  scheduled_at?: unknown;
  tags?: unknown;
};

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableStringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function stringArrayValue(value: unknown) {
  if (typeof value === "string") {
    return [value];
  }

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function tagsValue(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const name = "name" in item ? stringValue(item.name) : "";
    const tagValue = "value" in item ? stringValue(item.value) : "";

    return name ? [{ name, value: tagValue }] : [];
  });
}

function normalizeSummary(email: ResendApiEmail): ResendSentEmailSummary | null {
  const id = stringValue(email.id);

  if (!id) {
    return null;
  }

  return {
    id,
    to: stringArrayValue(email.to),
    from: stringValue(email.from),
    createdAt: stringValue(email.created_at),
    subject: stringValue(email.subject),
    bcc: stringArrayValue(email.bcc),
    cc: stringArrayValue(email.cc),
    replyTo: stringArrayValue(email.reply_to),
    lastEvent: stringValue(email.last_event, "sent"),
    scheduledAt: nullableStringValue(email.scheduled_at)
  };
}

function normalizeDetail(email: ResendApiEmail): ResendSentEmailDetail | null {
  const summary = normalizeSummary(email);

  if (!summary) {
    return null;
  }

  return {
    ...summary,
    html: nullableStringValue(email.html),
    text: nullableStringValue(email.text),
    tags: tagsValue(email.tags)
  };
}

function resendApiKey() {
  return process.env.RESEND_API_KEY?.trim() || null;
}

async function resendRequest(path: string) {
  const apiKey = resendApiKey();

  if (!apiKey) {
    return { configured: false as const, response: null, data: null, error: "RESEND_API_KEY is not configured." };
  }

  try {
    const response = await fetch(`${RESEND_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": RESEND_USER_AGENT
      },
      cache: "no-store"
    });
    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const providerMessage = data && typeof data === "object" && "message" in data ? stringValue(data.message) : "";
      return {
        configured: true as const,
        response,
        data: null,
        error: providerMessage || `Resend request failed (${response.status}).`
      };
    }

    return { configured: true as const, response, data, error: null };
  } catch (error) {
    return {
      configured: true as const,
      response: null,
      data: null,
      error: error instanceof Error ? error.message : "Resend request failed."
    };
  }
}

export async function listResendSentEmails(limit = 50): Promise<ResendSentEmailListResult> {
  const safeLimit = Math.min(100, Math.max(1, Math.round(limit)));
  const result = await resendRequest(`/emails?limit=${safeLimit}`);

  if (!result.configured || result.error || !result.data || typeof result.data !== "object") {
    return {
      emails: [],
      hasMore: false,
      configured: result.configured,
      error: result.error
    };
  }

  const rawEmails: unknown[] = "data" in result.data && Array.isArray(result.data.data) ? result.data.data : [];
  const emails = rawEmails.flatMap((email) => {
    if (!email || typeof email !== "object") {
      return [];
    }

    const normalized = normalizeSummary(email);
    return normalized ? [normalized] : [];
  });

  return {
    emails,
    hasMore: "has_more" in result.data && result.data.has_more === true,
    configured: true,
    error: null
  };
}

export async function getResendSentEmail(emailId: string) {
  const result = await resendRequest(`/emails/${encodeURIComponent(emailId)}`);

  if (!result.configured || result.error || !result.data || typeof result.data !== "object") {
    return {
      email: null,
      configured: result.configured,
      error: result.error
    };
  }

  const email = normalizeDetail(result.data);

  return {
    email,
    configured: true,
    error: email ? null : "The Resend email response is invalid."
  };
}
