import { NextResponse } from "next/server";
import { runR2MultipartCleanupJob } from "@/lib/r2-maintenance";

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

async function cleanupR2(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runR2MultipartCleanupJob();

    return NextResponse.json({
      ok: true,
      result
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "R2 multipart cleanup failed.";

    return NextResponse.json(
      {
        ok: false,
        message
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return cleanupR2(request);
}

export async function POST(request: Request) {
  return cleanupR2(request);
}
