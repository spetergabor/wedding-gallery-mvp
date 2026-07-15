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

type StripeOAuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  livemode?: boolean;
  stripe_user_id?: string;
  stripe_publishable_key?: string;
};

type StripeBalanceEntry = {
  amount?: number;
  currency?: string;
};

type StripeBalanceResponse = {
  available?: StripeBalanceEntry[];
  pending?: StripeBalanceEntry[];
};

export type ConnectedStripeBalanceEntry = {
  amount: number;
  currency: string;
};

export type ConnectedStripeBalance = {
  available: ConnectedStripeBalanceEntry[];
  pending: ConnectedStripeBalanceEntry[];
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

export const STRIPE_CONNECT_OAUTH_STATE_COOKIE = "spetly_stripe_connect_oauth_state";

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

function stripeClientId() {
  return process.env.STRIPE_CLIENT_ID?.trim() ?? "";
}

function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
}

export function stripeConnectMissingConfigKeys() {
  const keys: string[] = [];

  if (!stripeSecretKey()) {
    keys.push("STRIPE_SECRET_KEY");
  }

  if (!stripeClientId()) {
    keys.push("STRIPE_CLIENT_ID");
  }

  return keys;
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

function normalizeStripeBalanceEntries(entries: StripeBalanceEntry[] | undefined): ConnectedStripeBalanceEntry[] {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .map((entry) => ({
      amount: Number(entry.amount),
      currency: entry.currency?.toUpperCase() ?? ""
    }))
    .filter((entry) => Number.isFinite(entry.amount) && entry.currency.length > 0);
}

export function buildStripeStandardOAuthUrl({
  origin,
  state,
  email
}: {
  origin: string;
  state: string;
  email?: string | null;
}) {
  const clientId = stripeClientId();

  if (!clientId) {
    throw new Error("Missing STRIPE_CLIENT_ID.");
  }

  const url = new URL("https://connect.stripe.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", "read_write");
  url.searchParams.set("redirect_uri", `${origin}/api/stripe/connect/return`);
  url.searchParams.set("state", state);

  if (email?.trim()) {
    url.searchParams.set("stripe_user[email]", email.trim());
  }

  return url.toString();
}

export async function exchangeStripeOAuthCode(code: string) {
  const secretKey = stripeSecretKey();

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  const params = new URLSearchParams();
  params.set("code", code);
  params.set("grant_type", "authorization_code");

  const response = await fetch("https://connect.stripe.com/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString(),
    cache: "no-store"
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stripe OAuth token exchange failed: ${response.status} ${errorText.slice(0, 500)}`);
  }

  const token = (await response.json()) as StripeOAuthTokenResponse;

  if (!token.stripe_user_id) {
    throw new Error("Stripe OAuth response did not include stripe_user_id.");
  }

  return token;
}

export async function connectStandardStripeAccount(adminId: string, stripeAccountId: string) {
  const account = await stripeRequest<StripeAccount>(`/v1/accounts/${stripeAccountId}`);

  return prisma.stripeConnectIntegration.upsert({
    where: { adminId },
    create: {
      adminId,
      stripeAccountId,
      ...accountDataFromStripe(account),
      connectedAt: new Date()
    },
    update: {
      stripeAccountId,
      ...accountDataFromStripe(account),
      connectedAt: new Date()
    }
  });
}

export async function syncStripeAccount(adminId: string, stripeAccountId: string) {
  const account = await stripeRequest<StripeAccount>(`/v1/accounts/${stripeAccountId}`);

  return prisma.stripeConnectIntegration.update({
    where: { adminId },
    data: accountDataFromStripe(account)
  });
}

export async function retrieveConnectedStripeBalance(stripeAccountId: string): Promise<ConnectedStripeBalance> {
  const balance = await stripeRequest<StripeBalanceResponse>("/v1/balance", undefined, {
    connectedAccountId: stripeAccountId
  });

  return {
    available: normalizeStripeBalanceEntries(balance.available),
    pending: normalizeStripeBalanceEntries(balance.pending)
  };
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
  const normalizedAmountCents = Math.max(0, amountCents);
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("customer_email", customerEmail);
  params.set("client_reference_id", purchaseId);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", currency.toLowerCase());
  params.set("line_items[0][price_data][unit_amount]", String(normalizedAmountCents));
  params.set("line_items[0][price_data][product_data][name]", galleryTitle);
  params.set("line_items[0][price_data][product_data][description]", "Digitális galéria letöltés");
  params.set("metadata[purchaseId]", purchaseId);
  params.set("metadata[galleryId]", galleryId);
  params.set("metadata[adminId]", adminId);

  if (normalizedAmountCents === 0) {
    params.set("payment_method_collection", "if_required");
  } else {
    params.set("payment_intent_data[metadata][purchaseId]", purchaseId);
    params.set("payment_intent_data[metadata][galleryId]", galleryId);
    params.set("payment_intent_data[metadata][adminId]", adminId);
  }

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
