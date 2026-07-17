import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { customerMeetingStatusLabel, customerMeetingTypeLabel } from "@/lib/customer-meeting-options";
import { customerProjectStatusLabel, customerProjectTypeLabel } from "@/lib/customer-project-options";
import {
  customerTaskPriorityLabel,
  customerTaskStatusLabel,
  customerTaskTypeLabel,
  isClosedCustomerTaskStatus
} from "@/lib/customer-task-options";
import {
  createDeliveryLog,
  DELIVERY_CHANNEL_GOOGLE_CALENDAR,
  markDeliveryLogFailed,
  markDeliveryLogSent,
  markDeliveryLogSkipped
} from "@/lib/delivery-log";
import { adminMiniSessionUrl, miniSessionBookingCancelUrl, miniSessionPublicUrl } from "@/lib/email";
import {
  MINI_SESSION_BOOKING_SOURCE_BLOCKED,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_CANCELLED,
  miniSessionDateKey,
  parseMiniSessionLocalDateTime
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";
import { logSystemEvent } from "@/lib/system-events";

export const GOOGLE_CALENDAR_OAUTH_STATE_COOKIE = "wgm_google_calendar_oauth_state";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly"
];

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleProfileResponse = {
  id?: string;
  email?: string;
};

export type GoogleCalendarOption = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole?: string;
};

type GoogleCalendarListResponse = {
  items?: Array<{
    id?: string;
    summary?: string;
    primary?: boolean;
    accessRole?: string;
  }>;
};

type GoogleCalendarIntegrationForToken = {
  id: string;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  accessTokenExpiresAt: Date | null;
};

type GoogleCalendarIntegrationForSync = GoogleCalendarIntegrationForToken & {
  adminId: string;
  calendarId: string;
  calendarSummary: string | null;
  syncMiniSessionBookings: boolean;
  syncCustomerProjects: boolean;
  deleteCancelledEvents: boolean;
};

type GoogleCalendarIntegrationForAvailability = GoogleCalendarIntegrationForToken & {
  id: string;
  calendarId: string;
  blockAvailabilityFromGoogleCalendar: boolean;
};

type GoogleCalendarEventPayload = {
  summary: string;
  location?: string;
  description?: string;
  start: { dateTime: string; timeZone: string } | { date: string };
  end: { dateTime: string; timeZone: string } | { date: string };
  status?: "confirmed" | "cancelled" | "tentative";
};

type GoogleFreeBusyResponse = {
  calendars?: Record<string, {
    errors?: Array<{ domain?: string; reason?: string }>;
    busy?: Array<{ start?: string; end?: string }>;
  }>;
};

export class GoogleCalendarApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function isGoogleCalendarReconnectRequiredError(error: unknown) {
  return error instanceof GoogleCalendarApiError
    && error.status === 400
    && /expired|revoked|invalid_grant/i.test(error.message);
}

export function googleCalendarConfig() {
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";

  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? new URL("/api/google-calendar/callback", appBaseUrl).toString()
  };
}

export function isGoogleCalendarConfigured() {
  const config = googleCalendarConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

export function googleCalendarMissingConfigKeys() {
  const config = googleCalendarConfig();
  return [
    config.clientId ? null : "GOOGLE_CLIENT_ID",
    config.clientSecret ? null : "GOOGLE_CLIENT_SECRET",
    config.redirectUri ? null : "GOOGLE_REDIRECT_URI vagy NEXT_PUBLIC_APP_URL"
  ].filter((key): key is string => Boolean(key));
}

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000";
}

function tokenEncryptionSecret() {
  return process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ?? process.env.AUTH_SECRET ?? "dev-auth-secret-change-me";
}

function tokenEncryptionKey() {
  return createHash("sha256").update(tokenEncryptionSecret()).digest();
}

export function encryptGoogleToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptGoogleToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [version, ivValue, tagValue, encryptedValue] = value.split(":");

  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    return value;
  }

  const decipher = createDecipheriv("aes-256-gcm", tokenEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final()
  ]).toString("utf8");
}

export function buildGoogleCalendarOAuthUrl(state: string) {
  const config = googleCalendarConfig();
  const url = new URL(GOOGLE_AUTH_URL);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  return url.toString();
}

async function readGoogleTokenResponse(response: Response) {
  const payload = await response.json().catch(() => ({})) as GoogleTokenResponse;

  if (!response.ok || payload.error) {
    throw new GoogleCalendarApiError(
      response.status,
      payload.error_description || payload.error || `Google token request failed: ${response.status}`
    );
  }

  if (!payload.access_token) {
    throw new Error("Google token response did not include an access token.");
  }

  return payload;
}

export async function exchangeGoogleCalendarCode(code: string) {
  const config = googleCalendarConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    })
  });

  return readGoogleTokenResponse(response);
}

async function refreshGoogleCalendarToken(refreshToken: string) {
  const config = googleCalendarConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token"
    })
  });

  return readGoogleTokenResponse(response);
}

function tokenExpiryDate(expiresInSeconds: number | undefined) {
  return expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null;
}

async function getFreshGoogleCalendarAccessToken(integration: GoogleCalendarIntegrationForToken) {
  const encryptedAccessToken = integration.accessTokenEncrypted;
  const expiresAt = integration.accessTokenExpiresAt;

  if (encryptedAccessToken && expiresAt && expiresAt.getTime() > Date.now() + 60_000) {
    return decryptGoogleToken(encryptedAccessToken);
  }

  const refreshToken = decryptGoogleToken(integration.refreshTokenEncrypted);

  if (!refreshToken) {
    throw new Error("Google Calendar refresh token is missing.");
  }

  let refreshed: GoogleTokenResponse;

  try {
    refreshed = await refreshGoogleCalendarToken(refreshToken);
  } catch (error) {
    if (isGoogleCalendarReconnectRequiredError(error)) {
      await prisma.googleCalendarIntegration.update({
        where: { id: integration.id },
        data: {
          accessTokenEncrypted: null,
          accessTokenExpiresAt: null,
          lastSyncError: "A Google Calendar kapcsolat lejárt vagy vissza lett vonva. Kösd össze újra a Google naptárat."
        }
      }).catch(() => undefined);
    }

    throw error;
  }

  const encryptedToken = encryptGoogleToken(refreshed.access_token);
  const accessTokenExpiresAt = tokenExpiryDate(refreshed.expires_in);

  await prisma.googleCalendarIntegration.update({
    where: { id: integration.id },
    data: {
      accessTokenEncrypted: encryptedToken,
      accessTokenExpiresAt,
      scope: refreshed.scope ?? undefined,
      lastSyncError: null
    }
  });

  return refreshed.access_token ?? null;
}

export async function fetchGoogleCalendarProfile(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json().catch(() => ({})) as GoogleProfileResponse;

  if (!response.ok) {
    throw new GoogleCalendarApiError(response.status, payload.email || `Google profile request failed: ${response.status}`);
  }

  return payload;
}

export async function fetchGoogleCalendarList(accessToken: string): Promise<GoogleCalendarOption[]> {
  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json().catch(() => ({})) as GoogleCalendarListResponse;

  if (!response.ok) {
    throw new GoogleCalendarApiError(response.status, `Google calendar list request failed: ${response.status}`);
  }

  return (payload.items ?? [])
    .filter((calendar) => Boolean(calendar.id))
    .map((calendar) => ({
      id: calendar.id!,
      summary: calendar.summary || calendar.id!,
      primary: Boolean(calendar.primary),
      accessRole: calendar.accessRole
    }));
}

export async function getGoogleCalendarOptionsForIntegration(integration: GoogleCalendarIntegrationForToken | null) {
  if (!integration || !isGoogleCalendarConfigured()) {
    return [];
  }

  const accessToken = await getFreshGoogleCalendarAccessToken(integration);

  if (!accessToken) {
    return [];
  }

  return fetchGoogleCalendarList(accessToken);
}

async function googleCalendarRequest<T>(
  integration: GoogleCalendarIntegrationForToken,
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  const accessToken = await getFreshGoogleCalendarAccessToken(integration);

  if (!accessToken) {
    throw new Error("Google Calendar access token is missing.");
  }

  const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 204) {
    return null as T;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" && payload && "error" in payload
        ? JSON.stringify((payload as { error?: unknown }).error)
        : `Google Calendar API failed: ${response.status}`;
    throw new GoogleCalendarApiError(response.status, errorMessage);
  }

  return payload as T;
}

async function insertGoogleCalendarEvent(
  integration: GoogleCalendarIntegrationForSync,
  calendarId: string,
  event: GoogleCalendarEventPayload
) {
  const payload = await googleCalendarRequest<{ id?: string }>(
    integration,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: event }
  );

  if (!payload?.id) {
    throw new Error("Google Calendar event response did not include an id.");
  }

  return payload.id;
}

async function patchGoogleCalendarEvent(
  integration: GoogleCalendarIntegrationForSync,
  calendarId: string,
  eventId: string,
  event: GoogleCalendarEventPayload
) {
  await googleCalendarRequest(
    integration,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: event }
  );
}

async function deleteGoogleCalendarEvent(
  integration: GoogleCalendarIntegrationForSync,
  calendarId: string,
  eventId: string
) {
  try {
    await googleCalendarRequest(
      integration,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" }
    );
  } catch (error) {
    if (error instanceof GoogleCalendarApiError && error.status === 404) {
      return;
    }

    throw error;
  }
}

function googleDateTime(date: Date) {
  return {
    dateTime: date.toISOString(),
    timeZone: APP_TIME_ZONE
  };
}

function addDateKeyDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));

  return date.toISOString().slice(0, 10);
}

function googleAllDayDate(date: Date) {
  return miniSessionDateKey(date);
}

function projectAdminUrl(customerId: string) {
  return new URL(`/admin/clients/${customerId}?tab=projects`, appBaseUrl()).toString();
}

function meetingAdminUrl(customerId: string) {
  return new URL(`/admin/clients/${customerId}?tab=meetings`, appBaseUrl()).toString();
}

function taskAdminUrl(customerId: string) {
  return new URL(`/admin/clients/${customerId}?tab=tasks`, appBaseUrl()).toString();
}

function miniSessionBookingDescription(input: {
  sessionTitle: string;
  publicUrl: string;
  adminUrl: string;
  cancelUrl: string;
  name: string;
  email: string;
  phone: string;
  attendeeCount: number;
  adminNote?: string | null;
}) {
  return [
    `Mini session: ${input.sessionTitle}`,
    `Ügyfél: ${input.name}`,
    `E-mail: ${input.email}`,
    `Telefon: ${input.phone}`,
    `Létszám: ${input.attendeeCount}`,
    input.adminNote ? `Megjegyzés: ${input.adminNote}` : null,
    `Admin: ${input.adminUrl}`,
    `Publikus oldal: ${input.publicUrl}`,
    `Törlő link: ${input.cancelUrl}`
  ].filter(Boolean).join("\n");
}

function customerProjectDescription(input: {
  customerName: string;
  projectType: string;
  status: string;
  adminUrl: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}) {
  return [
    `Ügyfél: ${input.customerName}`,
    `Típus: ${customerProjectTypeLabel(input.projectType)}`,
    `Státusz: ${customerProjectStatusLabel(input.status)}`,
    input.email ? `E-mail: ${input.email}` : null,
    input.phone ? `Telefon: ${input.phone}` : null,
    input.notes ? `Megjegyzés: ${input.notes}` : null,
    `Admin: ${input.adminUrl}`
  ].filter(Boolean).join("\n");
}

function customerMeetingDescription(input: {
  customerName: string;
  meetingType: string;
  status: string;
  adminUrl: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}) {
  return [
    `Ügyfél: ${input.customerName}`,
    `Meeting típus: ${customerMeetingTypeLabel(input.meetingType)}`,
    `Státusz: ${customerMeetingStatusLabel(input.status)}`,
    input.email ? `E-mail: ${input.email}` : null,
    input.phone ? `Telefon: ${input.phone}` : null,
    input.notes ? `Megjegyzés: ${input.notes}` : null,
    `Admin: ${input.adminUrl}`
  ].filter(Boolean).join("\n");
}

function customerTaskDescription(input: {
  customerName: string;
  taskType: string;
  status: string;
  priority: string;
  adminUrl: string;
  projectTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}) {
  return [
    `Ügyfél: ${input.customerName}`,
    input.projectTitle ? `Kapcsolódó projekt: ${input.projectTitle}` : null,
    `Típus: ${customerTaskTypeLabel(input.taskType)}`,
    `Státusz: ${customerTaskStatusLabel(input.status)}`,
    `Prioritás: ${customerTaskPriorityLabel(input.priority)}`,
    input.email ? `E-mail: ${input.email}` : null,
    input.phone ? `Telefon: ${input.phone}` : null,
    input.notes ? `Megjegyzés: ${input.notes}` : null,
    `Admin: ${input.adminUrl}`
  ].filter(Boolean).join("\n");
}

function projectEventWindow(project: { eventDate: Date | null; startTime: string | null; endTime: string | null }) {
  if (!project.eventDate) {
    return null;
  }

  if (!project.startTime || !project.endTime) {
    const date = googleAllDayDate(project.eventDate);
    return {
      start: { date },
      end: { date: addDateKeyDays(date, 1) }
    };
  }

  const dateKey = miniSessionDateKey(project.eventDate);
  const startsAt = parseMiniSessionLocalDateTime(dateKey, project.startTime);
  let endsAt = parseMiniSessionLocalDateTime(dateKey, project.endTime);

  if (startsAt && endsAt && endsAt <= startsAt) {
    endsAt = parseMiniSessionLocalDateTime(addDateKeyDays(dateKey, 1), project.endTime);
  }

  if (!startsAt || !endsAt) {
    return null;
  }

  return {
    start: googleDateTime(startsAt),
    end: googleDateTime(endsAt)
  };
}

function taskEventWindow(task: { dueDate: Date | null; dueTime: string | null }) {
  if (!task.dueDate) {
    return null;
  }

  if (!task.dueTime) {
    const date = googleAllDayDate(task.dueDate);
    return {
      start: { date },
      end: { date: addDateKeyDays(date, 1) }
    };
  }

  const dateKey = miniSessionDateKey(task.dueDate);
  const startsAt = parseMiniSessionLocalDateTime(dateKey, task.dueTime);

  if (!startsAt) {
    return null;
  }

  return {
    start: googleDateTime(startsAt),
    end: googleDateTime(new Date(startsAt.getTime() + 30 * 60 * 1000))
  };
}

async function googleCalendarIntegrationForAdmin(adminId: string) {
  if (!isGoogleCalendarConfigured()) {
    return null;
  }

  return prisma.googleCalendarIntegration.findUnique({
    where: { adminId }
  });
}

function validGoogleBusyTime(input: { start?: string; end?: string }) {
  if (!input.start || !input.end) {
    return null;
  }

  const startsAt = new Date(input.start);
  const endsAt = new Date(input.end);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    return null;
  }

  return { startsAt, endsAt };
}

export async function getGoogleCalendarBusyTimesForAdmin(adminId: string, startsAt: Date, endsAt: Date) {
  if (!isGoogleCalendarConfigured() || endsAt <= startsAt) {
    return [];
  }

  const integration = await prisma.googleCalendarIntegration.findUnique({
    where: { adminId },
    select: {
      id: true,
      calendarId: true,
      accessTokenEncrypted: true,
      refreshTokenEncrypted: true,
      accessTokenExpiresAt: true,
      blockAvailabilityFromGoogleCalendar: true,
      lastSyncError: true
    }
  });

  if (!integration?.blockAvailabilityFromGoogleCalendar || !integration.refreshTokenEncrypted) {
    return [];
  }

  const calendarId = integration.calendarId || "primary";

  try {
    const payload = await googleCalendarRequest<GoogleFreeBusyResponse>(
      integration as GoogleCalendarIntegrationForAvailability,
      "/freeBusy",
      {
        method: "POST",
        body: {
          timeMin: startsAt.toISOString(),
          timeMax: endsAt.toISOString(),
          timeZone: APP_TIME_ZONE,
          items: [{ id: calendarId }]
        }
      }
    );
    const calendar = payload.calendars?.[calendarId];
    const errors = calendar?.errors ?? [];

    if (errors.length > 0) {
      throw new Error(errors.map((error) => error.reason || error.domain || "calendar error").join(", "));
    }

    if (integration.lastSyncError) {
      await prisma.googleCalendarIntegration.update({
        where: { id: integration.id },
        data: { lastSyncError: null }
      });
    }

    return (calendar?.busy ?? [])
      .map(validGoogleBusyTime)
      .filter((busyTime): busyTime is { startsAt: Date; endsAt: Date } => Boolean(busyTime));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar free/busy query failed.";

    await prisma.googleCalendarIntegration.update({
      where: { id: integration.id },
      data: { lastSyncError: message }
    }).catch(() => undefined);
    console.error("Google Calendar free/busy load failed", error);

    return [];
  }
}

export async function syncMiniSessionBookingToGoogleCalendar(bookingId: string) {
  const booking = await prisma.miniSessionBooking.findUnique({
    where: { id: bookingId },
    include: {
      miniSession: {
        select: {
          id: true,
          adminId: true,
          title: true,
          slug: true,
          location: true,
          admin: {
            select: {
              siteSettings: {
                select: {
                  publicSubdomain: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!booking || booking.source === MINI_SESSION_BOOKING_SOURCE_BLOCKED) {
    return { status: "skipped" as const };
  }

  const integration = await googleCalendarIntegrationForAdmin(booking.miniSession.adminId);

  if (!integration?.syncMiniSessionBookings || !integration.refreshTokenEncrypted) {
    return { status: "not_configured" as const };
  }

  const calendarId = integration.calendarId || "primary";
  const publicSubdomain = booking.miniSession.admin.siteSettings?.publicSubdomain ?? null;
  const deliveryLog = await createDeliveryLog({
    adminId: booking.miniSession.adminId,
    channel: DELIVERY_CHANNEL_GOOGLE_CALENDAR,
    type: "google_calendar.mini_session_booking.sync",
    provider: "google",
    entityType: "mini_session_booking",
    entityId: booking.id,
    subject: `${booking.name} - ${booking.miniSession.title}`,
    metadata: {
      sessionId: booking.miniSession.id,
      calendarId,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString()
    }
  });

  try {
    if (booking.status === MINI_SESSION_BOOKING_STATUS_CANCELLED && booking.googleCalendarEventId) {
      if (integration.deleteCancelledEvents) {
        await deleteGoogleCalendarEvent(integration, booking.googleCalendarId || calendarId, booking.googleCalendarEventId);
        await prisma.miniSessionBooking.update({
          where: { id: booking.id },
          data: {
            googleCalendarEventId: null,
            googleCalendarId: calendarId,
            googleCalendarSyncedAt: new Date(),
            googleCalendarSyncError: null
          }
        });
        await markDeliveryLogSent(deliveryLog.id, booking.googleCalendarEventId);
        return { status: "deleted" as const };
      }

      await patchGoogleCalendarEvent(integration, booking.googleCalendarId || calendarId, booking.googleCalendarEventId, {
        summary: `Törölve: ${booking.name} - ${booking.miniSession.title}`,
        location: booking.miniSession.location,
        description: miniSessionBookingDescription({
          sessionTitle: booking.miniSession.title,
          publicUrl: miniSessionPublicUrl(booking.miniSession.slug, publicSubdomain),
          adminUrl: adminMiniSessionUrl(booking.miniSession.id),
          cancelUrl: miniSessionBookingCancelUrl(booking.miniSession.slug, booking.cancelToken, publicSubdomain),
          name: booking.name,
          email: booking.email,
          phone: booking.phone,
          attendeeCount: booking.attendeeCount,
          adminNote: booking.adminNote
        }),
        start: googleDateTime(booking.startsAt),
        end: googleDateTime(booking.endsAt),
        status: "cancelled"
      });
      await prisma.miniSessionBooking.update({
        where: { id: booking.id },
        data: { googleCalendarId: calendarId, googleCalendarSyncedAt: new Date(), googleCalendarSyncError: null }
      });
      await markDeliveryLogSent(deliveryLog.id, booking.googleCalendarEventId);
      return { status: "cancelled" as const };
    }

    if (booking.status !== MINI_SESSION_BOOKING_STATUS_BOOKED) {
      await markDeliveryLogSkipped(deliveryLog.id, "A foglalás állapota miatt nem kell Google Calendar sync.");
      return { status: "skipped" as const };
    }

    const event: GoogleCalendarEventPayload = {
      summary: `${booking.name} - ${booking.miniSession.title}`,
      location: booking.miniSession.location,
      description: miniSessionBookingDescription({
        sessionTitle: booking.miniSession.title,
        publicUrl: miniSessionPublicUrl(booking.miniSession.slug, publicSubdomain),
        adminUrl: adminMiniSessionUrl(booking.miniSession.id),
        cancelUrl: miniSessionBookingCancelUrl(booking.miniSession.slug, booking.cancelToken, publicSubdomain),
        name: booking.name,
        email: booking.email,
        phone: booking.phone,
        attendeeCount: booking.attendeeCount,
        adminNote: booking.adminNote
      }),
      start: googleDateTime(booking.startsAt),
      end: googleDateTime(booking.endsAt)
    };
    let eventId = booking.googleCalendarEventId;

    if (eventId) {
      try {
        await patchGoogleCalendarEvent(integration, booking.googleCalendarId || calendarId, eventId, event);
      } catch (error) {
        if (!(error instanceof GoogleCalendarApiError) || error.status !== 404) {
          throw error;
        }

        eventId = await insertGoogleCalendarEvent(integration, calendarId, event);
      }
    } else {
      eventId = await insertGoogleCalendarEvent(integration, calendarId, event);
    }

    await prisma.miniSessionBooking.update({
      where: { id: booking.id },
      data: {
        googleCalendarEventId: eventId,
        googleCalendarId: calendarId,
        googleCalendarSyncedAt: new Date(),
        googleCalendarSyncError: null
      }
    });

    await markDeliveryLogSent(deliveryLog.id, eventId);
    return { status: "synced" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar sync failed.";
    await markDeliveryLogFailed(deliveryLog.id, error);
    await prisma.miniSessionBooking.update({
      where: { id: booking.id },
      data: { googleCalendarSyncError: message }
    });
    await prisma.googleCalendarIntegration.update({
      where: { id: integration.id },
      data: { lastSyncError: message }
    });
    await logSystemEvent({
      targetAdminId: booking.miniSession.adminId,
      type: "google_calendar.mini_session_booking.sync_failed",
      title: "Google Calendar mini session sync hiba",
      message,
      severity: "error",
      status: "failed",
      source: "google_calendar",
      href: adminMiniSessionUrl(booking.miniSession.id),
      metadata: {
        bookingId: booking.id,
        sessionId: booking.miniSession.id,
        calendarId,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString()
      }
    });
    console.error("Google Calendar mini session sync failed", error);
    return { status: "error" as const };
  }
}

export async function syncCustomerProjectToGoogleCalendar(projectId: string) {
  const project = await prisma.customerProject.findUnique({
    where: { id: projectId },
    include: {
      customer: {
        select: {
          id: true,
          adminId: true,
          coupleName: true,
          primaryEmail: true,
          phone: true
        }
      }
    }
  });

  if (!project) {
    return { status: "skipped" as const };
  }

  const integration = await googleCalendarIntegrationForAdmin(project.customer.adminId);

  if (!integration?.syncCustomerProjects || !integration.refreshTokenEncrypted) {
    return { status: "not_configured" as const };
  }

  const calendarId = integration.calendarId || "primary";
  const eventWindow = projectEventWindow(project);
  const deliveryLog = await createDeliveryLog({
    adminId: project.customer.adminId,
    channel: DELIVERY_CHANNEL_GOOGLE_CALENDAR,
    type: "google_calendar.customer_project.sync",
    provider: "google",
    entityType: "customer_project",
    entityId: project.id,
    subject: `${project.customer.coupleName} - ${project.title}`,
    metadata: {
      customerId: project.customer.id,
      calendarId,
      eventDate: project.eventDate?.toISOString() ?? null
    }
  });

  try {
    if ((!eventWindow || project.status === "archived") && project.googleCalendarEventId) {
      await deleteGoogleCalendarEvent(integration, project.googleCalendarId || calendarId, project.googleCalendarEventId);
      await prisma.customerProject.update({
        where: { id: project.id },
        data: {
          googleCalendarEventId: null,
          googleCalendarId: calendarId,
          googleCalendarSyncedAt: new Date(),
          googleCalendarSyncError: null
        }
      });
      await markDeliveryLogSent(deliveryLog.id, project.googleCalendarEventId);
      return { status: "deleted" as const };
    }

    if (!eventWindow || project.status === "archived") {
      await markDeliveryLogSkipped(deliveryLog.id, "A projekt állapota vagy dátuma miatt nem kell Google Calendar sync.");
      return { status: "skipped" as const };
    }

    const event: GoogleCalendarEventPayload = {
      summary: `${project.customer.coupleName} - ${project.title}`,
      location: project.venue ?? undefined,
      description: customerProjectDescription({
        customerName: project.customer.coupleName,
        projectType: project.projectType,
        status: project.status,
        adminUrl: projectAdminUrl(project.customer.id),
        email: project.customer.primaryEmail,
        phone: project.customer.phone,
        notes: project.notes
      }),
      start: eventWindow.start,
      end: eventWindow.end
    };
    let eventId = project.googleCalendarEventId;

    if (eventId) {
      try {
        await patchGoogleCalendarEvent(integration, project.googleCalendarId || calendarId, eventId, event);
      } catch (error) {
        if (!(error instanceof GoogleCalendarApiError) || error.status !== 404) {
          throw error;
        }

        eventId = await insertGoogleCalendarEvent(integration, calendarId, event);
      }
    } else {
      eventId = await insertGoogleCalendarEvent(integration, calendarId, event);
    }

    await prisma.customerProject.update({
      where: { id: project.id },
      data: {
        googleCalendarEventId: eventId,
        googleCalendarId: calendarId,
        googleCalendarSyncedAt: new Date(),
        googleCalendarSyncError: null
      }
    });

    await markDeliveryLogSent(deliveryLog.id, eventId);
    return { status: "synced" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar sync failed.";
    await markDeliveryLogFailed(deliveryLog.id, error);
    await prisma.customerProject.update({
      where: { id: project.id },
      data: { googleCalendarSyncError: message }
    });
    await prisma.googleCalendarIntegration.update({
      where: { id: integration.id },
      data: { lastSyncError: message }
    });
    await logSystemEvent({
      targetAdminId: project.customer.adminId,
      type: "google_calendar.customer_project.sync_failed",
      title: "Google Calendar projekt sync hiba",
      message,
      severity: "error",
      status: "failed",
      source: "google_calendar",
      href: projectAdminUrl(project.customer.id),
      metadata: {
        projectId: project.id,
        customerId: project.customer.id,
        calendarId
      }
    });
    console.error("Google Calendar customer project sync failed", error);
    return { status: "error" as const };
  }
}

export async function deleteCustomerProjectFromGoogleCalendar(projectId: string) {
  const project = await prisma.customerProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      googleCalendarEventId: true,
      googleCalendarId: true,
      customer: {
        select: {
          adminId: true
        }
      }
    }
  });

  if (!project?.googleCalendarEventId) {
    return { status: "skipped" as const };
  }

  const integration = await googleCalendarIntegrationForAdmin(project.customer.adminId);

  if (!integration?.syncCustomerProjects || !integration.refreshTokenEncrypted) {
    return { status: "not_configured" as const };
  }

  const calendarId = project.googleCalendarId || integration.calendarId || "primary";
  const deliveryLog = await createDeliveryLog({
    adminId: project.customer.adminId,
    channel: DELIVERY_CHANNEL_GOOGLE_CALENDAR,
    type: "google_calendar.customer_project.delete",
    provider: "google",
    entityType: "customer_project",
    entityId: project.id,
    subject: "Projekt Google Calendar esemény törlése",
    metadata: { calendarId }
  });

  try {
    await deleteGoogleCalendarEvent(integration, calendarId, project.googleCalendarEventId);
    await markDeliveryLogSent(deliveryLog.id, project.googleCalendarEventId);
    return { status: "deleted" as const };
  } catch (error) {
    await markDeliveryLogFailed(deliveryLog.id, error);
    console.error("Google Calendar customer project delete failed", error);
    return { status: "error" as const };
  }
}

export async function syncCustomerMeetingToGoogleCalendar(meetingId: string) {
  const meeting = await prisma.customerMeeting.findUnique({
    where: { id: meetingId },
    include: {
      customer: {
        select: {
          id: true,
          adminId: true,
          coupleName: true,
          primaryEmail: true,
          phone: true
        }
      }
    }
  });

  if (!meeting) {
    return { status: "skipped" as const };
  }

  const integration = await googleCalendarIntegrationForAdmin(meeting.customer.adminId);

  if (!integration?.syncCustomerProjects || !integration.refreshTokenEncrypted) {
    return { status: "not_configured" as const };
  }

  const calendarId = integration.calendarId || "primary";
  const eventWindow = projectEventWindow(meeting);
  const deliveryLog = await createDeliveryLog({
    adminId: meeting.customer.adminId,
    channel: DELIVERY_CHANNEL_GOOGLE_CALENDAR,
    type: "google_calendar.customer_meeting.sync",
    provider: "google",
    entityType: "customer_meeting",
    entityId: meeting.id,
    subject: `${meeting.customer.coupleName} - ${meeting.title}`,
    metadata: {
      customerId: meeting.customer.id,
      calendarId,
      eventDate: meeting.eventDate.toISOString()
    }
  });

  try {
    if ((!eventWindow || meeting.status === "cancelled") && meeting.googleCalendarEventId) {
      await deleteGoogleCalendarEvent(integration, meeting.googleCalendarId || calendarId, meeting.googleCalendarEventId);
      await prisma.customerMeeting.update({
        where: { id: meeting.id },
        data: {
          googleCalendarEventId: null,
          googleCalendarId: calendarId,
          googleCalendarSyncedAt: new Date(),
          googleCalendarSyncError: null
        }
      });
      await markDeliveryLogSent(deliveryLog.id, meeting.googleCalendarEventId);
      return { status: "deleted" as const };
    }

    if (!eventWindow || meeting.status === "cancelled") {
      await markDeliveryLogSkipped(deliveryLog.id, "A meeting állapota vagy dátuma miatt nem kell Google Calendar sync.");
      return { status: "skipped" as const };
    }

    const event: GoogleCalendarEventPayload = {
      summary: `${meeting.customer.coupleName} - ${meeting.title}`,
      location: meeting.location ?? undefined,
      description: customerMeetingDescription({
        customerName: meeting.customer.coupleName,
        meetingType: meeting.meetingType,
        status: meeting.status,
        adminUrl: meetingAdminUrl(meeting.customer.id),
        email: meeting.customer.primaryEmail,
        phone: meeting.customer.phone,
        notes: meeting.notes
      }),
      start: eventWindow.start,
      end: eventWindow.end
    };
    let eventId = meeting.googleCalendarEventId;

    if (eventId) {
      try {
        await patchGoogleCalendarEvent(integration, meeting.googleCalendarId || calendarId, eventId, event);
      } catch (error) {
        if (!(error instanceof GoogleCalendarApiError) || error.status !== 404) {
          throw error;
        }

        eventId = await insertGoogleCalendarEvent(integration, calendarId, event);
      }
    } else {
      eventId = await insertGoogleCalendarEvent(integration, calendarId, event);
    }

    await prisma.customerMeeting.update({
      where: { id: meeting.id },
      data: {
        googleCalendarEventId: eventId,
        googleCalendarId: calendarId,
        googleCalendarSyncedAt: new Date(),
        googleCalendarSyncError: null
      }
    });

    await markDeliveryLogSent(deliveryLog.id, eventId);
    return { status: "synced" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar sync failed.";
    await markDeliveryLogFailed(deliveryLog.id, error);
    await prisma.customerMeeting.update({
      where: { id: meeting.id },
      data: { googleCalendarSyncError: message }
    });
    await prisma.googleCalendarIntegration.update({
      where: { id: integration.id },
      data: { lastSyncError: message }
    });
    await logSystemEvent({
      targetAdminId: meeting.customer.adminId,
      type: "google_calendar.customer_meeting.sync_failed",
      title: "Google Calendar meeting sync hiba",
      message,
      severity: "error",
      status: "failed",
      source: "google_calendar",
      href: meetingAdminUrl(meeting.customer.id),
      metadata: {
        meetingId: meeting.id,
        customerId: meeting.customer.id,
        calendarId
      }
    });
    console.error("Google Calendar customer meeting sync failed", error);
    return { status: "error" as const };
  }
}

export async function deleteCustomerMeetingFromGoogleCalendar(meetingId: string) {
  const meeting = await prisma.customerMeeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      googleCalendarEventId: true,
      googleCalendarId: true,
      customer: {
        select: {
          adminId: true
        }
      }
    }
  });

  if (!meeting?.googleCalendarEventId) {
    return { status: "skipped" as const };
  }

  const integration = await googleCalendarIntegrationForAdmin(meeting.customer.adminId);

  if (!integration?.syncCustomerProjects || !integration.refreshTokenEncrypted) {
    return { status: "not_configured" as const };
  }

  const calendarId = meeting.googleCalendarId || integration.calendarId || "primary";
  const deliveryLog = await createDeliveryLog({
    adminId: meeting.customer.adminId,
    channel: DELIVERY_CHANNEL_GOOGLE_CALENDAR,
    type: "google_calendar.customer_meeting.delete",
    provider: "google",
    entityType: "customer_meeting",
    entityId: meeting.id,
    subject: "Meeting Google Calendar esemény törlése",
    metadata: { calendarId }
  });

  try {
    await deleteGoogleCalendarEvent(integration, calendarId, meeting.googleCalendarEventId);
    await markDeliveryLogSent(deliveryLog.id, meeting.googleCalendarEventId);
    return { status: "deleted" as const };
  } catch (error) {
    await markDeliveryLogFailed(deliveryLog.id, error);
    console.error("Google Calendar customer meeting delete failed", error);
    return { status: "error" as const };
  }
}

export async function syncCustomerTaskToGoogleCalendar(taskId: string) {
  const task = await prisma.customerTask.findUnique({
    where: { id: taskId },
    include: {
      customer: {
        select: {
          id: true,
          adminId: true,
          coupleName: true,
          primaryEmail: true,
          phone: true
        }
      },
      project: {
        select: {
          title: true
        }
      }
    }
  });

  if (!task) {
    return { status: "skipped" as const };
  }

  const integration = await googleCalendarIntegrationForAdmin(task.customer.adminId);

  if (!integration?.syncCustomerProjects || !integration.refreshTokenEncrypted) {
    return { status: "not_configured" as const };
  }

  const calendarId = integration.calendarId || "primary";
  const eventWindow = taskEventWindow(task);
  const deliveryLog = await createDeliveryLog({
    adminId: task.customer.adminId,
    channel: DELIVERY_CHANNEL_GOOGLE_CALENDAR,
    type: "google_calendar.customer_task.sync",
    provider: "google",
    entityType: "customer_task",
    entityId: task.id,
    subject: `${task.customer.coupleName} - ${task.title}`,
    metadata: {
      customerId: task.customer.id,
      projectTitle: task.project?.title ?? null,
      calendarId,
      dueDate: task.dueDate?.toISOString() ?? null,
      dueTime: task.dueTime
    }
  });

  try {
    if ((!eventWindow || isClosedCustomerTaskStatus(task.status)) && task.googleCalendarEventId) {
      await deleteGoogleCalendarEvent(integration, task.googleCalendarId || calendarId, task.googleCalendarEventId);
      await prisma.customerTask.update({
        where: { id: task.id },
        data: {
          googleCalendarEventId: null,
          googleCalendarId: calendarId,
          googleCalendarSyncedAt: new Date(),
          googleCalendarSyncError: null
        }
      });
      await markDeliveryLogSent(deliveryLog.id, task.googleCalendarEventId);
      return { status: "deleted" as const };
    }

    if (!eventWindow || isClosedCustomerTaskStatus(task.status)) {
      await markDeliveryLogSkipped(deliveryLog.id, "A feladat állapota vagy határideje miatt nem kell Google Calendar sync.");
      return { status: "skipped" as const };
    }

    const event: GoogleCalendarEventPayload = {
      summary: `${task.customer.coupleName} - ${task.title}`,
      description: customerTaskDescription({
        customerName: task.customer.coupleName,
        taskType: task.taskType,
        status: task.status,
        priority: task.priority,
        adminUrl: taskAdminUrl(task.customer.id),
        projectTitle: task.project?.title,
        email: task.customer.primaryEmail,
        phone: task.customer.phone,
        notes: task.notes
      }),
      start: eventWindow.start,
      end: eventWindow.end
    };
    let eventId = task.googleCalendarEventId;

    if (eventId) {
      try {
        await patchGoogleCalendarEvent(integration, task.googleCalendarId || calendarId, eventId, event);
      } catch (error) {
        if (!(error instanceof GoogleCalendarApiError) || error.status !== 404) {
          throw error;
        }

        eventId = await insertGoogleCalendarEvent(integration, calendarId, event);
      }
    } else {
      eventId = await insertGoogleCalendarEvent(integration, calendarId, event);
    }

    await prisma.customerTask.update({
      where: { id: task.id },
      data: {
        googleCalendarEventId: eventId,
        googleCalendarId: calendarId,
        googleCalendarSyncedAt: new Date(),
        googleCalendarSyncError: null
      }
    });

    await markDeliveryLogSent(deliveryLog.id, eventId);
    return { status: "synced" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar sync failed.";
    await markDeliveryLogFailed(deliveryLog.id, error);
    await prisma.customerTask.update({
      where: { id: task.id },
      data: { googleCalendarSyncError: message }
    });
    await prisma.googleCalendarIntegration.update({
      where: { id: integration.id },
      data: { lastSyncError: message }
    });
    await logSystemEvent({
      targetAdminId: task.customer.adminId,
      type: "google_calendar.customer_task.sync_failed",
      title: "Google Calendar feladat sync hiba",
      message,
      severity: "error",
      status: "failed",
      source: "google_calendar",
      href: taskAdminUrl(task.customer.id),
      metadata: {
        taskId: task.id,
        customerId: task.customer.id,
        calendarId
      }
    });
    console.error("Google Calendar customer task sync failed", error);
    return { status: "error" as const };
  }
}

export async function deleteCustomerTaskFromGoogleCalendar(taskId: string) {
  const task = await prisma.customerTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      googleCalendarEventId: true,
      googleCalendarId: true,
      customer: {
        select: {
          adminId: true
        }
      }
    }
  });

  if (!task?.googleCalendarEventId) {
    return { status: "skipped" as const };
  }

  const integration = await googleCalendarIntegrationForAdmin(task.customer.adminId);

  if (!integration?.syncCustomerProjects || !integration.refreshTokenEncrypted) {
    return { status: "not_configured" as const };
  }

  const calendarId = task.googleCalendarId || integration.calendarId || "primary";
  const deliveryLog = await createDeliveryLog({
    adminId: task.customer.adminId,
    channel: DELIVERY_CHANNEL_GOOGLE_CALENDAR,
    type: "google_calendar.customer_task.delete",
    provider: "google",
    entityType: "customer_task",
    entityId: task.id,
    subject: "Feladat Google Calendar esemény törlése",
    metadata: { calendarId }
  });

  try {
    await deleteGoogleCalendarEvent(integration, calendarId, task.googleCalendarEventId);
    await markDeliveryLogSent(deliveryLog.id, task.googleCalendarEventId);
    return { status: "deleted" as const };
  } catch (error) {
    await markDeliveryLogFailed(deliveryLog.id, error);
    console.error("Google Calendar customer task delete failed", error);
    return { status: "error" as const };
  }
}
