import { NextResponse } from "next/server";
import { getDeploymentVersion } from "@/lib/deployment-version";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: getDeploymentVersion() },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store"
      }
    }
  );
}
