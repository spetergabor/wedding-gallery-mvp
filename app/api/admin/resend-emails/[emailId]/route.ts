import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { getResendSentEmail } from "@/lib/resend-email-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ emailId: string }> }) {
  await requireSuperAdmin();
  const { emailId } = await params;

  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(emailId)) {
    return NextResponse.json({ message: "Invalid email id." }, { status: 400 });
  }

  const result = await getResendSentEmail(emailId);

  if (!result.email) {
    return NextResponse.json(
      { message: result.error || "The email could not be loaded." },
      {
        status: result.configured ? 502 : 503,
        headers: { "Cache-Control": "no-store, max-age=0" }
      }
    );
  }

  return NextResponse.json(
    { email: result.email },
    {
      headers: { "Cache-Control": "no-store, max-age=0" }
    }
  );
}
