import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { dispatchAdminNotification } from "@/lib/admin-notification-preferences";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_FIELD_LENGTH = 4000;
const TOKEN_QUERY_KEYS = ["token", "secret", "api_key", "apiKey"];
const HONEYPOT_KEYS = ["hp", "honeypot", "spetly_honeypot", "company_website"];

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function webhookToken() {
  return envValue("SPETLY_GIFT_CARD_WEBHOOK_TOKEN") || envValue("SPETLY_LEAD_WEBHOOK_TOKEN");
}

function webhookAdminEmail() {
  return (
    envValue("SPETLY_GIFT_CARD_WEBHOOK_ADMIN_EMAIL") ||
    envValue("SPETLY_LEAD_WEBHOOK_ADMIN_EMAIL") ||
    envValue("ADMIN_NOTIFICATION_EMAIL")
  ).toLowerCase();
}

function text(value: unknown) {
  if (typeof value === "string") {
    return value.trim().slice(0, MAX_FIELD_LENGTH);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim().slice(0, MAX_FIELD_LENGTH);
  }

  return "";
}

function normalizeKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_äöüßáéíóöőúüű]/g, "");
}

function appendField(fields: Record<string, string>, key: string, value: unknown) {
  const cleanValue = text(value);

  if (!cleanValue) {
    return;
  }

  fields[key] = cleanValue;
  fields[normalizeKey(key)] = cleanValue;

  for (const match of key.matchAll(/\[([^\]]+)\]/g)) {
    const alias = normalizeKey(match[1] ?? "");
    if (alias && !["fields", "form_fields", "value", "raw_value"].includes(alias)) {
      fields[alias] = cleanValue;
    }
  }
}

function flattenObject(fields: Record<string, string>, value: unknown, prefix = "") {
  if (!value || typeof value !== "object") {
    if (prefix) {
      appendField(fields, prefix, value);
    }
    return;
  }

  if (Array.isArray(value)) {
    appendField(fields, prefix, value.map((item) => text(item)).filter(Boolean).join(", "));
    return;
  }

  for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
    const nextPrefix = prefix ? `${prefix}_${key}` : key;

    if (entryValue && typeof entryValue === "object" && !Array.isArray(entryValue)) {
      const elementorField = entryValue as Record<string, unknown>;
      const label = text(elementorField.title || elementorField.label || elementorField.name || key);
      const fieldValue = elementorField.value ?? elementorField.raw_value;

      if (fieldValue !== undefined) {
        appendField(fields, key, fieldValue);
        if (label) {
          appendField(fields, label, fieldValue);
        }
        continue;
      }
    }

    flattenObject(fields, entryValue, nextPrefix);
  }
}

async function readRequestFields(request: NextRequest) {
  const fields: Record<string, string> = {};
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    flattenObject(fields, await request.json().catch(() => null));
    return fields;
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return fields;
  }

  for (const [key, value] of formData.entries()) {
    appendField(fields, key, value);
  }

  return fields;
}

function readFirst(fields: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = fields[key] || fields[normalizeKey(key)];
    if (value) {
      return value;
    }
  }
  return "";
}

function tokenFromRequest(request: NextRequest, fields: Record<string, string>) {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  for (const key of TOKEN_QUERY_KEYS) {
    const queryValue = request.nextUrl.searchParams.get(key);
    if (queryValue) {
      return queryValue.trim();
    }
  }

  return readFirst(fields, TOKEN_QUERY_KEYS);
}

function json(status: number, body: Record<string, unknown>, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers });
}

export async function POST(request: NextRequest) {
  const configuredToken = webhookToken();
  const adminEmail = webhookAdminEmail();

  if (!configuredToken || !adminEmail) {
    return json(503, { ok: false, message: "Gift card webhook is not configured." });
  }

  const fields = await readRequestFields(request);
  if (tokenFromRequest(request, fields) !== configuredToken) {
    return json(401, { ok: false, message: "Unauthorized." });
  }

  if (HONEYPOT_KEYS.some((key) => Boolean(fields[key] || fields[normalizeKey(key)]))) {
    return json(202, { ok: true, ignored: true });
  }

  const rateLimit = await consumeRateLimit({
    scope: "public-gift-card-webhook",
    limit: 60,
    windowSeconds: 60 * 60,
    identifier: adminEmail
  });

  if (rateLimit.limited) {
    return json(
      429,
      { ok: false, message: "Too many gift card submissions. Please try again later." },
      { "Retry-After": String(rateLimit.retryAfterSeconds) }
    );
  }

  const customerName = readFirst(fields, ["name", "dein_name", "customer_name", "kundenname"]);
  const email = readFirst(fields, ["email", "e_mail_adresse", "e-mail_adresse", "email_address"]).toLowerCase();
  const recipientName = readFirst(fields, [
    "field_828b669",
    "der_name_der_beschenkten_person",
    "recipient_name",
    "beschenkte_person"
  ]);
  const personCountValue = readFirst(fields, [
    "field_bced22f",
    "anzahl_der_personen_wie_viele_personen_kommen_zum_fotoshooting",
    "person_count",
    "personen"
  ]);
  const deliveryMethod = readFirst(fields, ["field_7eb3a52", "abholung", "delivery_method"]);
  const deliveryAddress = readFirst(fields, ["field_8db93ce", "lieferadresse", "delivery_address"]);
  const message = readFirst(fields, ["message", "nachricht_optional", "nachricht", "notes"]);
  const source = readFirst(fields, ["form_name", "elementor_form_name"]) || "Irismoment.at – Geschenkkarte";
  const personCount = Number.parseInt(personCountValue, 10);

  if (!email || !recipientName || !deliveryMethod || !Number.isInteger(personCount) || personCount < 1 || personCount > 20) {
    return json(400, { ok: false, message: "Missing or invalid gift card order data." });
  }

  const admin = await prisma.admin.findUnique({
    where: { email: adminEmail },
    select: { id: true }
  });

  if (!admin) {
    return json(503, { ok: false, message: "Gift card order owner is not configured." });
  }

  const order = await prisma.giftCardOrder.create({
    data: {
      adminId: admin.id,
      customerName: (customerName || email).slice(0, 200),
      email: email.slice(0, 320),
      recipientName: recipientName.slice(0, 200),
      personCount,
      deliveryMethod: deliveryMethod.slice(0, 120),
      deliveryAddress: deliveryAddress ? deliveryAddress.slice(0, 1000) : null,
      message: message ? message.slice(0, 4000) : null,
      source: source.slice(0, 200)
    },
    select: { id: true }
  });

  await dispatchAdminNotification({
    adminId: admin.id,
    topic: "gift_card_order",
    title: "Új ajándékkártya-rendelés",
    message: `${customerName || email} ${personCount} főre rendelt ajándékkártyát.`,
    href: `/admin/gift-card-orders#order-${order.id}`
  });

  revalidatePath("/admin/gift-card-orders");
  revalidatePath("/admin/notifications");

  return json(200, { ok: true, orderId: order.id });
}
