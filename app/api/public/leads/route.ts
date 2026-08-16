import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { dispatchAdminNotification } from "@/lib/admin-notification-preferences";
import { ensureLeadPipelineSchema, normalizeLeadEventType } from "@/lib/leads";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type LeadPayload = {
  name: string;
  email: string | null;
  phone: string | null;
  eventType: string;
  eventDate: Date | null;
  venue: string | null;
  notes: string | null;
  source: string;
  raw: Record<string, string>;
};

const MAX_FIELD_LENGTH = 2000;
const TOKEN_QUERY_KEYS = ["token", "secret", "api_key", "apiKey"];
const HONEYPOT_KEYS = ["hp", "honeypot", "spetly_honeypot", "company_website"];

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

function webhookToken() {
  return envValue("SPETLY_LEAD_WEBHOOK_TOKEN");
}

function webhookAdminEmail() {
  return (envValue("SPETLY_LEAD_WEBHOOK_ADMIN_EMAIL") || envValue("ADMIN_NOTIFICATION_EMAIL")).toLowerCase();
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

function readFirst(fields: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const direct = fields[key];
    const normalized = fields[normalizeKey(key)];

    if (direct) {
      return direct;
    }

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function parseDate(value: string) {
  if (!value) {
    return null;
  }

  const isoLike = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const european = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  const dateValue = isoLike
    ? `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`
    : european
      ? `${european[3]}-${european[2].padStart(2, "0")}-${european[1].padStart(2, "0")}`
      : "";

  if (!dateValue) {
    return null;
  }

  const date = new Date(`${dateValue}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function appendField(fields: Record<string, string>, key: string, value: unknown) {
  const cleanValue = text(value);

  if (!cleanValue) {
    return;
  }

  fields[key] = cleanValue;
  fields[normalizeKey(key)] = cleanValue;

  const bracketAliases = Array.from(key.matchAll(/\[([^\]]+)\]/g))
    .map((match) => normalizeKey(match[1] ?? ""))
    .filter((part) => part && !["fields", "form_fields", "value", "raw_value"].includes(part));

  for (const alias of bracketAliases) {
    fields[alias] = cleanValue;
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
      const maybeElementorField = entryValue as Record<string, unknown>;
      const label = text(maybeElementorField.title || maybeElementorField.label || maybeElementorField.name || key);
      const fieldValue = maybeElementorField.value ?? maybeElementorField.raw_value;

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
  const contentType = request.headers.get("content-type") ?? "";
  const fields: Record<string, string> = {};

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

function hasSpamHoneypot(fields: Record<string, string>) {
  return HONEYPOT_KEYS.some((key) => Boolean(fields[key] || fields[normalizeKey(key)]));
}

function normalizedKeySet(keys: string[]) {
  return new Set(keys.map((key) => normalizeKey(key)));
}

function buildPayload(fields: Record<string, string>): LeadPayload | null {
  const firstName = readFirst(fields, ["first_name", "firstname", "vorname", "keresztnev", "keresztnév"]);
  const lastName = readFirst(fields, ["last_name", "lastname", "nachname", "vezeteknev", "vezetéknév"]);
  const brideName = readFirst(fields, [
    "bride_name",
    "name2",
    "braut_name",
    "name_der_braut",
    "name_braut",
    "braut",
    "menyasszony_neve",
    "menyasszony"
  ]);
  const groomName = readFirst(fields, [
    "groom_name",
    "field_529e117",
    "bräutigam_name",
    "braeutigam_name",
    "name_des_bräutigams",
    "name_des_braeutigams",
    "name_bräutigam",
    "name_braeutigam",
    "bräutigam",
    "braeutigam",
    "vőlegény_neve",
    "volegeny_neve",
    "vőlegény",
    "volegeny"
  ]);
  const coupleName = [brideName, groomName].filter(Boolean).join(" & ");
  const name =
    readFirst(fields, [
      "name",
      "full_name",
      "fullname",
      "your_name",
      "name_des_brautpaares",
      "paar",
      "couple",
      "couple_name",
      "kundenname",
      "nev",
      "név"
    ]) ||
    coupleName ||
    [firstName, lastName].filter(Boolean).join(" ");
  const email = readFirst(fields, [
    "email",
    "email2",
    "e_mail",
    "mail",
    "your_email",
    "email_address",
    "e_mail_adresse",
    "e-mail-adresse",
    "e_mail_addresse",
    "e-mail-addresse"
  ]);
  const phone = readFirst(fields, [
    "phone",
    "field_0d66287",
    "telefon",
    "tel",
    "mobile",
    "handy",
    "your_phone",
    "telefonnummer"
  ]);
  const eventDateValue = readFirst(fields, [
    "event_date",
    "field_b84931f",
    "wedding_date",
    "hochzeitsdatum",
    "datum",
    "date",
    "esküvő_dátuma",
    "eskuvo_datuma"
  ]);
  const venue = readFirst(fields, [
    "venue",
    "field_5912a3a",
    "location",
    "ort",
    "ort_der_hochzeit",
    "location_venue",
    "hochzeitslocation",
    "hochzeitsort",
    "helyszín",
    "helyszin"
  ]);
  const eventType = readFirst(fields, ["event_type", "shooting_type", "type", "paket", "package", "shooting", "service"]) || "wedding";
  const guestCount = readFirst(fields, [
    "guest_count",
    "field_2259102",
    "guests",
    "anzahl_der_gäste",
    "anzahl_der_gäste_ca",
    "anzahl_der_gaeste",
    "anzahl_der_gaeste_ca",
    "anzahl_gäste",
    "anzahl_gäste_ca",
    "anzahl_gaeste",
    "anzahl_gaeste_ca",
    "vendégek_száma",
    "vendegek_szama"
  ]);
  const referralSource = readFirst(fields, [
    "referral_source",
    "field_2615fbc",
    "found_us",
    "how_found",
    "how_did_you_find_me",
    "wie_habt_ihr_mich_gefunden",
    "wie_habt_ihr_mich_gefunden_",
    "source"
  ]);
  const message = readFirst(fields, [
    "message",
    "message2",
    "nachricht",
    "your_message",
    "notes",
    "comment",
    "kommentar",
    "uzenet",
    "üzenet"
  ]);
  const source = readFirst(fields, ["form_name", "form_id", "elementor_form_name"]) || "Elementor";

  if (!name && !email) {
    return null;
  }

  const surfacedKeys = normalizedKeySet([
    ...TOKEN_QUERY_KEYS,
    ...HONEYPOT_KEYS,
    "name",
    "full_name",
    "fullname",
    "your_name",
    "name_des_brautpaares",
    "paar",
    "couple",
    "couple_name",
    "kundenname",
    "nev",
    "név",
    "first_name",
    "firstname",
    "vorname",
    "last_name",
    "lastname",
    "nachname",
    "bride_name",
    "name2",
    "braut_name",
    "name_der_braut",
    "name_braut",
    "braut",
    "menyasszony_neve",
    "menyasszony",
    "groom_name",
    "field_529e117",
    "bräutigam_name",
    "braeutigam_name",
    "name_des_bräutigams",
    "name_des_braeutigams",
    "name_bräutigam",
    "name_braeutigam",
    "bräutigam",
    "braeutigam",
    "vőlegény_neve",
    "volegeny_neve",
    "vőlegény",
    "volegeny",
    "email",
    "email2",
    "e_mail",
    "mail",
    "your_email",
    "email_address",
    "e_mail_adresse",
    "e-mail-adresse",
    "e_mail_addresse",
    "e-mail-addresse",
    "phone",
    "field_0d66287",
    "telefon",
    "tel",
    "mobile",
    "handy",
    "your_phone",
    "telefonnummer",
    "event_date",
    "field_b84931f",
    "wedding_date",
    "hochzeitsdatum",
    "datum",
    "date",
    "venue",
    "field_5912a3a",
    "location",
    "ort",
    "ort_der_hochzeit",
    "location_venue",
    "hochzeitslocation",
    "hochzeitsort",
    "helyszín",
    "helyszin",
    "event_type",
    "shooting_type",
    "type",
    "paket",
    "package",
    "shooting",
    "service",
    "guest_count",
    "field_2259102",
    "guests",
    "anzahl_der_gäste",
    "anzahl_der_gäste_ca",
    "anzahl_der_gaeste",
    "anzahl_der_gaeste_ca",
    "anzahl_gäste",
    "anzahl_gäste_ca",
    "anzahl_gaeste",
    "anzahl_gaeste_ca",
    "referral_source",
    "field_2615fbc",
    "found_us",
    "how_found",
    "how_did_you_find_me",
    "wie_habt_ihr_mich_gefunden",
    "wie_habt_ihr_mich_gefunden_",
    "source",
    "form_name",
    "form_id",
    "elementor_form_name",
    "message",
    "message2",
    "nachricht",
    "your_message",
    "notes",
    "comment",
    "kommentar"
  ]);
  const seenRawValues = new Set<string>();
  const extraFieldLines = Object.entries(fields)
    .filter(([key, value]) => {
      const normalizedKey = normalizeKey(key);
      const normalizedValue = value.trim().toLowerCase();

      if (!normalizedValue || surfacedKeys.has(normalizedKey)) {
        return false;
      }

      if (seenRawValues.has(normalizedValue)) {
        return false;
      }

      seenRawValues.add(normalizedValue);
      return true;
    })
    .slice(0, 20)
    .map(([key, value]) => `${key}: ${value}`);

  const noteLines = [
    "Automatikus ajánlatkérés weboldalról.",
    `Forrás: ${source}`,
    brideName ? `Menyasszony: ${brideName}` : "",
    groomName ? `Vőlegény: ${groomName}` : "",
    guestCount ? `Vendégszám kb.: ${guestCount}` : "",
    referralSource ? `Honnan találtak meg: ${referralSource}` : "",
    message ? `Üzenet: ${message}` : "",
    ...extraFieldLines
  ].filter(Boolean);

  return {
    name: name || email,
    email: email ? email.toLowerCase() : null,
    phone: phone || null,
    eventType: normalizeLeadEventType(normalizeKey(eventType)),
    eventDate: parseDate(eventDateValue),
    venue: venue || null,
    notes: noteLines.join("\n").slice(0, 6000),
    source,
    raw: fields
  };
}

function json(status: number, body: Record<string, unknown>, headers?: HeadersInit) {
  return NextResponse.json(body, { status, headers });
}

export async function POST(request: NextRequest) {
  const configuredToken = webhookToken();
  const adminEmail = webhookAdminEmail();

  if (!configuredToken || !adminEmail) {
    return json(503, { ok: false, message: "Lead webhook is not configured." });
  }

  const fields = await readRequestFields(request);
  const requestToken = tokenFromRequest(request, fields);

  if (requestToken !== configuredToken) {
    return json(401, { ok: false, message: "Unauthorized." });
  }

  if (hasSpamHoneypot(fields)) {
    return json(202, { ok: true, ignored: true });
  }

  const rateLimit = await consumeRateLimit({
    scope: "public-lead-webhook",
    limit: 30,
    windowSeconds: 60 * 60,
    identifier: adminEmail
  });

  if (rateLimit.limited) {
    return json(
      429,
      { ok: false, message: "Too many lead submissions. Please try again later." },
      { "Retry-After": String(rateLimit.retryAfterSeconds) }
    );
  }

  const payload = buildPayload(fields);

  if (!payload) {
    return json(400, { ok: false, message: "Missing required lead data." });
  }

  const admin = await prisma.admin.findUnique({
    where: { email: adminEmail },
    select: { id: true, email: true }
  });

  if (!admin) {
    return json(503, { ok: false, message: "Lead owner is not configured." });
  }

  await ensureLeadPipelineSchema(prisma);

  const maxSort = await prisma.lead.aggregate({
    where: {
      adminId: admin.id,
      status: "requested"
    },
    _max: { sortOrder: true }
  });

  const lead = await prisma.lead.create({
    data: {
      adminId: admin.id,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      eventType: payload.eventType,
      eventDate: payload.eventDate,
      venue: payload.venue,
      status: "requested",
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      notes: payload.notes
    },
    select: {
      id: true
    }
  });

  await dispatchAdminNotification({
    adminId: admin.id,
    topic: "lead_created",
    title: "Új ajánlatkérés érkezett",
    message: `${payload.name} ajánlatkérést küldött a weboldalról.`,
    href: "/admin/dashboard#lead-pipeline"
  });

  revalidatePath("/admin/dashboard");

  return json(200, { ok: true, leadId: lead.id });
}
