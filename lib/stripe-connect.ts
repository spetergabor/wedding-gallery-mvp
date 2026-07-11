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

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

export function stripeConnectMissingConfigKeys() {
  return stripeSecretKey() ? [] : ["STRIPE_SECRET_KEY"];
}

export function isStripeConnectConfigured() {
  return stripeConnectMissingConfigKeys().length === 0;
}

async function stripeRequest<T>(path: string, params?: URLSearchParams): Promise<T> {
  const secretKey = stripeSecretKey();

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
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
