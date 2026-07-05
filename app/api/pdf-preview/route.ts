import { NextRequest, NextResponse } from "next/server";
import { R2_PUBLIC_BASE_URL } from "@/lib/storage";

export const dynamic = "force-dynamic";

function isAllowedPdfUrl(value: string, origin: string) {
  if (value.startsWith("/uploads/")) {
    return new URL(value, origin).toString();
  }

  try {
    const url = new URL(value);
    const allowedR2Base = new URL(R2_PUBLIC_BASE_URL.replace(/\/$/, ""));

    if (url.origin === allowedR2Base.origin && url.pathname.startsWith(`${allowedR2Base.pathname.replace(/\/$/, "")}/`)) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url") ?? "";
  const sourceUrl = isAllowedPdfUrl(rawUrl, request.nextUrl.origin);

  if (!sourceUrl) {
    return NextResponse.json({ error: "Invalid PDF URL" }, { status: 400 });
  }

  const response = await fetch(sourceUrl, { cache: "no-store" });

  if (!response.ok) {
    return NextResponse.json({ error: "PDF could not be loaded" }, { status: response.status });
  }

  return new NextResponse(response.body, {
    headers: {
      "Cache-Control": "private, max-age=120",
      "Content-Type": response.headers.get("content-type") ?? "application/pdf"
    }
  });
}
