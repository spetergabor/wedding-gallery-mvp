import { NextResponse } from "next/server";

// Multi-device irismoment workspace synchronisation is intentionally disabled.
// Edge execution protects the Fluid CPU allowance even if an older desktop
// build keeps calling this retired endpoint.
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
