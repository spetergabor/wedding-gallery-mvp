import { NextResponse } from "next/server";
import { runCustomerInvoiceReminders } from "@/lib/customer-invoice-reminders";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean((secret && request.headers.get("authorization") === `Bearer ${secret}`) || request.headers.get("x-vercel-cron") === "1" || process.env.NODE_ENV !== "production");
}

async function run(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, reminders: await runCustomerInvoiceReminders() });
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }
