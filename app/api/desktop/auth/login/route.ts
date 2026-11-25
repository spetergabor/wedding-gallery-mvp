import { NextResponse } from "next/server";
import { authenticateDesktopAdmin, createDesktopAccessToken } from "@/lib/desktop-auth";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    email?: unknown;
    password?: unknown;
    twoFactorCode?: unknown;
  };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 320) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const twoFactorCode = typeof body.twoFactorCode === "string" ? body.twoFactorCode.replace(/\s/g, "").slice(0, 12) : "";

  const rateLimit = await consumeRateLimit({
    scope: "auth:desktop",
    limit: 8,
    windowSeconds: 15 * 60,
    identifier: email
  });
  if (rateLimit.limited) {
    return NextResponse.json(
      { ok: false, code: "rate_limited", message: "Túl sok belépési próbálkozás." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds), "Cache-Control": "no-store" } }
    );
  }

  if (!email || !password) {
    return NextResponse.json({ ok: false, code: "missing", message: "Email és jelszó szükséges." }, { status: 400 });
  }

  const result = await authenticateDesktopAdmin(email, password, twoFactorCode || undefined);
  if (result.status === "two_factor_required") {
    return NextResponse.json({ ok: false, code: result.status, message: "Kétfaktoros kód szükséges." }, { status: 401 });
  }
  if (result.status === "pending") {
    return NextResponse.json({ ok: false, code: result.status, message: "A fiók még jóváhagyásra vár." }, { status: 403 });
  }
  if (result.status === "forbidden") {
    return NextResponse.json({ ok: false, code: result.status, message: "Ehhez az alkalmazáshoz főadmin jogosultság szükséges." }, { status: 403 });
  }
  if (result.status !== "success") {
    return NextResponse.json({ ok: false, code: "invalid", message: "Hibás belépési adatok." }, { status: 401 });
  }

  const access = createDesktopAccessToken(result.admin);
  return NextResponse.json({
    ok: true,
    ...access,
    user: { email: result.admin.email, name: result.admin.name, role: "super_admin" }
  }, { headers: { "Cache-Control": "no-store" } });
}
