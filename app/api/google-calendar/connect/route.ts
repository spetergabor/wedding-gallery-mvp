import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  buildGoogleCalendarOAuthUrl,
  GOOGLE_CALENDAR_OAUTH_STATE_COOKIE,
  isGoogleCalendarConfigured
} from "@/lib/google-calendar-api";

function settingsUrl(params: Record<string, string>) {
  const url = new URL("/admin/settings", process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000");
  url.searchParams.set("tab", "integrations");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

export async function GET() {
  const admin = await requireAdmin();

  if (admin.isTeamWorkspace) {
    return NextResponse.redirect(settingsUrl({ google: "team-workspace" }));
  }

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(settingsUrl({ google: "missing-config" }));
  }

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(buildGoogleCalendarOAuthUrl(state));

  response.cookies.set(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/google-calendar/callback",
    maxAge: 10 * 60
  });

  return response;
}
