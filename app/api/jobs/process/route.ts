import { NextResponse } from "next/server";
import { processPendingJobs } from "@/lib/jobs";

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

async function processJobs(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const results = await processPendingJobs({ limit: 2 });

  return NextResponse.json({
    ok: true,
    ...results
  });
}

export async function GET(request: Request) {
  return processJobs(request);
}

export async function POST(request: Request) {
  return processJobs(request);
}
