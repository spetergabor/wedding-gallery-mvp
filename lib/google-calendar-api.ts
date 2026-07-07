import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { customerProjectStatusLabel, customerProjectTypeLabel } from "@/lib/customer-project-options";
import { adminMiniSessionUrl, miniSessionBookingCancelUrl, miniSessionPublicUrl } from "@/lib/email";
import {
  MINI_SESSION_BOOKING_SOURCE_BLOCKED,
  MINI_SESSION_BOOKING_STATUS_BOOKED,
  MINI_SESSION_BOOKING_STATUS_CANCELLED,
  miniSessionDateKey,
  parseMiniSessionLocalDateTime
} from "@/lib/mini-sessions";
import { prisma } from "@/lib/prisma";

export const GOOGLE_CALENDAR_OAUTH_STATE_COOKIE = "wgm_google_calendar_oauth_state";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
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

type GoogleCalendarEventPayload = {
  summary: string;
  location?: string;
  description?: string;
  start: { dateTime: string; timeZone: string } | { date: string };
  end: { dateTime: string; timeZone: string } | { date: string };
  status?: "confirmed" | "cancelled" | "tentative";
};

class GoogleCalendarApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
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

  const refreshed = await refreshGoogleCalendarToken(refreshToken);
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
    throw new GoogleCalendarApiError(response.status, `Google Calendar API failed: ${response.status}`);
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

async function googleCalendarIntegrationForAdmin(adminId: string) {
  if (!isGoogleCalendarConfigured()) {
    return null;
  }

  return prisma.googleCalendarIntegration.findUnique({
    where: { adminId }
  });
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
          location: true
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
        return { status: "deleted" as const };
      }

      await patchGoogleCalendarEvent(integration, booking.googleCalendarId || calendarId, booking.googleCalendarEventId, {
        summary: `Törölve: ${booking.name} - ${booking.miniSession.title}`,
        location: booking.miniSession.location,
        description: miniSessionBookingDescription({
          sessionTitle: booking.miniSession.title,
          publicUrl: miniSessionPublicUrl(booking.miniSession.slug),
          adminUrl: adminMiniSessionUrl(booking.miniSession.id),
          cancelUrl: miniSessionBookingCancelUrl(booking.miniSession.slug, booking.cancelToken),
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
      return { status: "cancelled" as const };
    }

    if (booking.status !== MINI_SESSION_BOOKING_STATUS_BOOKED) {
      return { status: "skipped" as const };
    }

    const event: GoogleCalendarEventPayload = {
      summary: `${booking.name} - ${booking.miniSession.title}`,
      location: booking.miniSession.location,
      description: miniSessionBookingDescription({
        sessionTitle: booking.miniSession.title,
        publicUrl: miniSessionPublicUrl(booking.miniSession.slug),
        adminUrl: adminMiniSessionUrl(booking.miniSession.id),
        cancelUrl: miniSessionBookingCancelUrl(booking.miniSession.slug, booking.cancelToken),
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

    return { status: "synced" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar sync failed.";
    await prisma.miniSessionBooking.update({
      where: { id: booking.id },
      data: { googleCalendarSyncError: message }
    });
    await prisma.googleCalendarIntegration.update({
      where: { id: integration.id },
      data: { lastSyncError: message }
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
      return { status: "deleted" as const };
    }

    if (!eventWindow || project.status === "archived") {
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

    return { status: "synced" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Calendar sync failed.";
    await prisma.customerProject.update({
      where: { id: project.id },
      data: { googleCalendarSyncError: message }
    });
    await prisma.googleCalendarIntegration.update({
      where: { id: integration.id },
      data: { lastSyncError: message }
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

  try {
    await deleteGoogleCalendarEvent(integration, project.googleCalendarId || integration.calendarId || "primary", project.googleCalendarEventId);
    return { status: "deleted" as const };
  } catch (error) {
    console.error("Google Calendar customer project delete failed", error);
    return { status: "error" as const };
  }
}
