import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

type StripeAccount = {
  id: string;
  email?: string | null;
  country?: string | null;
  default_currency?: string | null;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
};

export type StripeCheckoutSession = {
  id: string;
  url?: string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_intent?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  customer_email?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  customer_details?: {
    email?: string | null;
    name?: string | null;
  } | null;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  account?: string;
  data: {
    object: StripeCheckoutSession;
  };
};

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
}

export function stripeConnectMissingConfigKeys() {
  return stripeSecretKey() ? [] : ["STRIPE_SECRET_KEY"];
}

export function isStripeConnectConfigured() {
  return stripeConnectMissingConfigKeys().length === 0;
}

export function isStripeWebhookConfigured() {
  return Boolean(stripeWebhookSecret());
}

async function stripeRequest<T>(
  path: string,
  params?: URLSearchParams,
  options: { connectedAccountId?: string } = {}
): Promise<T> {
  const secretKey = stripeSecretKey();

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(options.connectedAccountId ? { "Stripe-Account": options.connectedAccountId } : {}),
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body: params?.toString(),
    cache: "no-store"
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stripe request failed: ${response.status} ${errorText.slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

function accountDataFromStripe(account: StripeAccount) {
  return {
    stripeAccountEmail: account.email ?? null,
    country: account.country ?? null,
    defaultCurrency: account.default_currency ?? null,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    onboardingCompletedAt: account.details_submitted ? new Date() : null,
    lastSyncError: null
  };
}

export async function syncStripeAccount(adminId: string, stripeAccountId: string) {
  const account = await stripeRequest<StripeAccount>(`/v1/accounts/${stripeAccountId}`);

  return prisma.stripeConnectIntegration.update({
    where: { adminId },
    data: accountDataFromStripe(account)
  });
}

export async function createStripeConnectAccountLink({
  adminId,
  email,
  name,
  origin
}: {
  adminId: string;
  email: string;
  name: string;
  origin: string;
}) {
  const existing = await prisma.stripeConnectIntegration.findUnique({
    where: { adminId },
    select: { stripeAccountId: true }
  });
  let stripeAccountId = existing?.stripeAccountId;

  if (!stripeAccountId) {
    const params = new URLSearchParams();
    params.set("type", "express");
    params.set("email", email);
    params.set("business_type", "individual");
    params.set("business_profile[name]", name);
    params.set("business_profile[url]", origin);
    params.set("capabilities[card_payments][requested]", "true");
    params.set("capabilities[transfers][requested]", "true");

    const account = await stripeRequest<StripeAccount>("/v1/accounts", params);
    stripeAccountId = account.id;

    await prisma.stripeConnectIntegration.create({
      data: {
        adminId,
        stripeAccountId,
        ...accountDataFromStripe(account)
      }
    });
  }

  const linkParams = new URLSearchParams();
  linkParams.set("account", stripeAccountId);
  linkParams.set("refresh_url", `${origin}/api/stripe/connect`);
  linkParams.set("return_url", `${origin}/api/stripe/connect/return`);
  linkParams.set("type", "account_onboarding");

  const accountLink = await stripeRequest<{ url: string }>("/v1/account_links", linkParams);

  return accountLink.url;
}

export async function createConnectedCheckoutSession({
  stripeAccountId,
  purchaseId,
  galleryId,
  adminId,
  galleryTitle,
  customerEmail,
  customerName,
  amountCents,
  currency,
  successUrl,
  cancelUrl
}: {
  stripeAccountId: string;
  purchaseId: string;
  galleryId: string;
  adminId: string;
  galleryTitle: string;
  customerEmail: string;
  customerName?: string | null;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("customer_email", customerEmail);
  params.set("client_reference_id", purchaseId);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", currency.toLowerCase());
  params.set("line_items[0][price_data][unit_amount]", String(amountCents));
  params.set("line_items[0][price_data][product_data][name]", galleryTitle);
  params.set("line_items[0][price_data][product_data][description]", "Digitális galéria letöltés");
  params.set("metadata[purchaseId]", purchaseId);
  params.set("metadata[galleryId]", galleryId);
  params.set("metadata[adminId]", adminId);
  params.set("payment_intent_data[metadata][purchaseId]", purchaseId);
  params.set("payment_intent_data[metadata][galleryId]", galleryId);
  params.set("payment_intent_data[metadata][adminId]", adminId);

  if (customerName?.trim()) {
    params.set("metadata[customerName]", customerName.trim().slice(0, 250));
  }

  return stripeRequest<StripeCheckoutSession>("/v1/checkout/sessions", params, {
    connectedAccountId: stripeAccountId
  });
}

export async function retrieveConnectedCheckoutSession(stripeAccountId: string, sessionId: string) {
  return stripeRequest<StripeCheckoutSession>(`/v1/checkout/sessions/${sessionId}`, undefined, {
    connectedAccountId: stripeAccountId
  });
}

export function verifyStripeWebhookEvent(payload: string, signatureHeader: string | null) {
  const secret = stripeWebhookSecret();

  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET.");
  }

  const parts = Object.fromEntries(
    (signatureHeader ?? "")
      .split(",")
      .map((part) => part.split("="))
      .filter((part): part is [string, string] => part.length === 2)
  );
  const timestamp = parts.t;
  const signatures = (signatureHeader ?? "")
    .split(",")
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) {
    throw new Error("Missing Stripe webhook signature.");
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const isValid = signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature, "hex");

    return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer);
  });

  if (!isValid) {
    throw new Error("Invalid Stripe webhook signature.");
  }

  const timestampMs = Number.parseInt(timestamp, 10) * 1000;
  if (Number.isFinite(timestampMs) && Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    throw new Error("Stripe webhook signature timestamp is outside tolerance.");
  }

  return JSON.parse(payload) as StripeWebhookEvent;
}
