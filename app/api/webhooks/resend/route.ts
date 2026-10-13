import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { parseResendWebhookPayload, recordResendWebhookEvent } from "@/lib/resend-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    console.error("Resend webhook is not configured. Missing RESEND_WEBHOOK_SECRET.");
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const rawPayload = await request.text();
  const webhookId = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");

  if (!webhookId || !timestamp || !signature) {
    return NextResponse.json({ error: "Missing webhook signature." }, { status: 400 });
  }

  let verifiedPayload: unknown;

  try {
    verifiedPayload = new Webhook(webhookSecret).verify(rawPayload, {
      "svix-id": webhookId,
      "svix-timestamp": timestamp,
      "svix-signature": signature
    });
  } catch (error) {
    console.error("Resend webhook verification failed", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    const payload = parseResendWebhookPayload(verifiedPayload);
    const result = await recordResendWebhookEvent({ webhookId, payload });
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    console.error("Resend webhook handling failed", { webhookId, error });
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
