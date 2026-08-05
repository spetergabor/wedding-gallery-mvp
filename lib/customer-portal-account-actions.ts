"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { customerAccessWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import {
  createCustomerPortalSession,
  deleteCurrentCustomerPortalSession,
  isValidCustomerLoginIdentifier,
  normalizeCustomerLoginIdentifier,
  requireCustomerPortalSession
} from "@/lib/customer-portal-auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { isAnyRateLimited } from "@/lib/rate-limit";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function adminPortalRedirect(customerId: string, query: string): never {
  redirect(`/admin/clients/${customerId}?tab=portal&${query}`);
}

export async function loginCustomerPortalAction(formData: FormData) {
  const loginIdentifier = normalizeCustomerLoginIdentifier(formString(formData, "loginIdentifier"));
  const password = formString(formData, "password");

  if (
    await isAnyRateLimited([
      { scope: "auth:customer-portal:identifier", limit: 6, windowSeconds: 15 * 60, identifier: loginIdentifier },
      { scope: "auth:customer-portal:ip", limit: 40, windowSeconds: 15 * 60, identifier: "global" }
    ])
  ) {
    redirect("/portal/login?error=rate_limit");
  }

  const account = loginIdentifier
    ? await prisma.customerPortalAccount.findUnique({
        where: { loginIdentifier },
        select: {
          id: true,
          passwordHash: true,
          status: true,
          mustChangePassword: true,
          customer: { select: { customerType: true } }
        }
      })
    : null;
  const validPassword = account && password
    ? await verifyPassword(password, account.passwordHash)
    : false;

  if (!account || !validPassword || account.status !== "active" || account.customer.customerType !== "wedding_couple") {
    redirect("/portal/login?error=invalid");
  }

  await createCustomerPortalSession(account.id);
  redirect(account.mustChangePassword ? "/portal/account/password" : "/portal/account");
}

export async function changeCustomerPortalPasswordAction(formData: FormData) {
  const session = await requireCustomerPortalSession({ allowPasswordChange: true });
  const password = formString(formData, "password");
  const confirmation = formString(formData, "passwordConfirmation");

  if (password.length < 10) {
    redirect("/portal/account/password?error=length");
  }

  if (password !== confirmation) {
    redirect("/portal/account/password?error=confirmation");
  }

  const passwordHash = await hashPassword(password);

  await prisma.customerPortalAccount.update({
    where: { id: session.account.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date()
    }
  });

  redirect("/portal/account?password=changed");
}

export async function logoutCustomerPortalAction() {
  await deleteCurrentCustomerPortalSession();
  redirect("/portal/login?signedOut=1");
}

export async function saveCustomerPortalAccountAction(
  customerId: string,
  accountId: string | null,
  formData: FormData
) {
  const admin = await requireAdmin();
  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, customerId),
    select: { id: true, customerType: true }
  });

  if (!customer || customer.customerType !== "wedding_couple") {
    adminPortalRedirect(customerId, "portalAccountError=customer");
  }

  const loginIdentifier = normalizeCustomerLoginIdentifier(formString(formData, "loginIdentifier"));
  const displayName = formString(formData, "displayName").slice(0, 100) || null;
  const password = formString(formData, "password");
  const emailInput = formString(formData, "email").toLowerCase();
  const email = (loginIdentifier.includes("@") ? loginIdentifier : emailInput) || null;

  if (!isValidCustomerLoginIdentifier(loginIdentifier)) {
    adminPortalRedirect(customerId, "portalAccountError=identifier");
  }

  if (!accountId && password.length < 10) {
    adminPortalRedirect(customerId, "portalAccountError=password");
  }

  const existingAccount = accountId
    ? await prisma.customerPortalAccount.findFirst({
        where: { id: accountId, customerId: customer.id },
        select: { id: true }
      })
    : null;

  if (accountId && !existingAccount) {
    adminPortalRedirect(customerId, "portalAccountError=missing");
  }

  try {
    if (existingAccount) {
      const replacementPasswordHash = password.length >= 10 ? await hashPassword(password) : null;

      await prisma.$transaction(async (transaction) => {
        await transaction.customerPortalAccount.update({
          where: { id: existingAccount.id },
          data: {
            loginIdentifier,
            email,
            displayName,
            ...(replacementPasswordHash
              ? {
                  passwordHash: replacementPasswordHash,
                  mustChangePassword: true,
                  passwordChangedAt: null
                }
              : {})
          }
        });

        if (password.length >= 10) {
          await transaction.customerPortalSession.deleteMany({ where: { accountId: existingAccount.id } });
        }
      });
    } else {
      await prisma.customerPortalAccount.create({
        data: {
          customerId: customer.id,
          loginIdentifier,
          email,
          displayName,
          passwordHash: await hashPassword(password),
          mustChangePassword: true
        }
      });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      adminPortalRedirect(customerId, "portalAccountError=taken");
    }

    throw error;
  }

  revalidatePath(`/admin/clients/${customer.id}`);
  adminPortalRedirect(customer.id, `portalAccount=${existingAccount ? "updated" : "created"}`);
}

export async function setCustomerPortalAccountStatusAction(
  customerId: string,
  accountId: string,
  active: boolean
) {
  const admin = await requireAdmin();
  const account = await prisma.customerPortalAccount.findFirst({
    where: {
      id: accountId,
      customerId,
      customer: customerAccessWhere(admin, customerId)
    },
    select: { id: true }
  });

  if (!account) {
    adminPortalRedirect(customerId, "portalAccountError=missing");
  }

  await prisma.$transaction([
    prisma.customerPortalAccount.update({
      where: { id: account.id },
      data: { status: active ? "active" : "disabled" }
    }),
    ...(!active
      ? [prisma.customerPortalSession.deleteMany({ where: { accountId: account.id } })]
      : [])
  ]);

  revalidatePath(`/admin/clients/${customerId}`);
  adminPortalRedirect(customerId, `portalAccount=${active ? "enabled" : "disabled"}`);
}
