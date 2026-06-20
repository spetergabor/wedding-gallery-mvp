import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPORT_TOKEN = "tmp-env-export-20260620-6f4a1a9254e648bb9aa059ac5e31b52d";

const ENV_KEYS = [
  "DATABASE_URL",
  "STORAGE_DRIVER",
  "R2_BUCKET_NAME",
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "NEXT_PUBLIC_R2_PUBLIC_BASE_URL"
] as const;

export async function GET(request: Request) {
  if (request.headers.get("x-speter-env-export") !== EXPORT_TOKEN) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key] ?? ""]))
  );
}
