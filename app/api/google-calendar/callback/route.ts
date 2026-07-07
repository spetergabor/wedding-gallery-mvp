import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import {
  encryptGoogleToken,
  exchangeGoogleCalendarCode,
  fetchGoogleCalendarList,
  fetchGoogleCalendarProfile,
  GOOGLE_CALENDAR_OAUTH_STATE_COOKIE,
  isGoogleCalendarConfigured
} from "@/lib/google-calendar-api";
import { prisma } from "@/lib/prisma";

function settingsUrl(params: Record<string, string>) {
  const url = new URL("/admin/settings", process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000");
  url.searchParams.set("tab", "integrations");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

function tokenExpiryDate(expiresInSeconds: number | undefined) {
  return expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();

  if (admin.isTeamWorkspace) {
    return NextResponse.redirect(settingsUrl({ google: "team-workspace" }));
  }

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(settingsUrl({ google: "missing-config" }));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const googleError = request.nextUrl.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE)?.value;

  if (googleError) {
    const response = NextResponse.redirect(settingsUrl({ google: "oauth-error" }));
    response.cookies.delete(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE);
    return response;
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    const response = NextResponse.redirect(settingsUrl({ google: "state-error" }));
    response.cookies.delete(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE);
    return response;
  }

  const adminId = ownerAdminId(admin);

  try {
    const existing = await prisma.googleCalendarIntegration.findUnique({
      where: { adminId },
      select: { refreshTokenEncrypted: true }
    });
    const token = await exchangeGoogleCalendarCode(code);
    const profile = await fetchGoogleCalendarProfile(token.access_token!);
    const calendars = await fetchGoogleCalendarList(token.access_token!);
    const selectedCalendar = calendars.find((calendar) => calendar.primary) ?? calendars[0] ?? null;
    const refreshTokenEncrypted = token.refresh_token
      ? encryptGoogleToken(token.refresh_token)
      : existing?.refreshTokenEncrypted ?? null;

    if (!refreshTokenEncrypted) {
      const response = NextResponse.redirect(settingsUrl({ google: "no-refresh-token" }));
      response.cookies.delete(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE);
      return response;
    }

    await prisma.googleCalendarIntegration.upsert({
      where: { adminId },
      create: {
        adminId,
        googleAccountEmail: profile.email ?? null,
        googleAccountId: profile.id ?? null,
        calendarId: selectedCalendar?.id ?? "primary",
        calendarSummary: selectedCalendar?.summary ?? null,
        accessTokenEncrypted: encryptGoogleToken(token.access_token),
        refreshTokenEncrypted,
        accessTokenExpiresAt: tokenExpiryDate(token.expires_in),
        scope: token.scope ?? null,
        lastSyncError: null
      },
      update: {
        googleAccountEmail: profile.email ?? null,
        googleAccountId: profile.id ?? null,
        calendarId: selectedCalendar?.id ?? "primary",
        calendarSummary: selectedCalendar?.summary ?? null,
        accessTokenEncrypted: encryptGoogleToken(token.access_token),
        refreshTokenEncrypted,
        accessTokenExpiresAt: tokenExpiryDate(token.expires_in),
        scope: token.scope ?? null,
        lastSyncError: null,
        connectedAt: new Date()
      }
    });

    const response = NextResponse.redirect(settingsUrl({ google: "connected" }));
    response.cookies.delete(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("Google Calendar OAuth callback failed", error);
    const response = NextResponse.redirect(settingsUrl({ google: "callback-error" }));
    response.cookies.delete(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE);
    return response;
  }
}
