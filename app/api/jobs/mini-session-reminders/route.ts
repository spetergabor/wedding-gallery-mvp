import { NextResponse } from "next/server";
import { sendMiniSessionReminderEmails } from "@/lib/mini-session-reminders";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const vercelCronHeader = request.headers.get("x-vercel-cron");

  if (secret && authHeader === `Bearer ${secret}`) {
    return true;
  }

  if (vercelCronHeader === "1") {
    return true;
  }

  return process.env.NODE_ENV !== "production";
}

async function processMiniSessionReminders(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const reminders = await sendMiniSessionReminderEmails();

  return NextResponse.json({
    ok: true,
    reminders
  });
}

export async function GET(request: Request) {
  return processMiniSessionReminders(request);
}

export async function POST(request: Request) {
  return processMiniSessionReminders(request);
}
