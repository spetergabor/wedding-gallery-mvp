import { NextResponse } from "next/server";

// Multi-device irismoment workspace synchronisation is intentionally disabled.
// Keep this endpoint on the Edge runtime so outdated desktop builds that still
// poll it cannot consume Vercel Fluid Active CPU or touch the database.
export const runtime = "edge";

function disabledResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "shared_workspace_sync_disabled",
      message: "The irismoment shared workspace sync is disabled."
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"
      }
    }
  );
}

export async function GET() {
  return disabledResponse();
}

export async function PATCH() {
  return disabledResponse();
}

export async function DELETE() {
  return disabledResponse();
}
