"use server";

import { revalidatePath } from "next/cache";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EDITABLE_STATUS_FIELDS = ["delivered", "paid", "photographed"] as const;

type EditableStatusField = (typeof EDITABLE_STATUS_FIELDS)[number];

type UpdateGiftCardOrderStatusInput = {
  orderId: string;
  field: EditableStatusField;
  value: boolean;
};

type UpdateGiftCardOrderDetailsInput = {
  orderId: string;
  customerName: string;
  email: string;
  recipientName: string;
  personCount: string;
  deliveryMethod: string;
  deliveryAddress: string;
  amount: string;
  invoiceNumber: string;
  message: string;
  delivered: boolean;
  paid: boolean;
  photographed: boolean;
};

function requiredText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function optionalText(value: unknown, maxLength: number) {
  const cleanValue = requiredText(value, maxLength);
  return cleanValue || null;
}

function amountInCents(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const amount = Number(value.trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) return undefined;
  return Math.round(amount * 100);
}

export async function updateGiftCardOrderStatus(input: UpdateGiftCardOrderStatusInput) {
  if (
    !input ||
    typeof input.orderId !== "string" ||
    !EDITABLE_STATUS_FIELDS.includes(input.field) ||
    typeof input.value !== "boolean"
  ) {
    return { ok: false as const, message: "Invalid status update." };
  }

  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  const data =
    input.field === "delivered"
      ? { delivered: input.value }
      : input.field === "paid"
        ? { paid: input.value }
        : { photographed: input.value };

  const result = await prisma.giftCardOrder.updateMany({
    where: { id: input.orderId, adminId },
    data
  });

  if (result.count !== 1) {
    return { ok: false as const, message: "Gift card order not found." };
  }

  revalidatePath("/admin/gift-card-orders");
  return { ok: true as const };
}

export async function updateGiftCardOrderDetails(input: UpdateGiftCardOrderDetailsInput) {
  const customerName = requiredText(input?.customerName, 200);
  const email = requiredText(input?.email, 320).toLowerCase();
  const recipientName = requiredText(input?.recipientName, 200);
  const deliveryMethod = requiredText(input?.deliveryMethod, 120);
  const personCount = Number(input?.personCount);
  const amountCents = amountInCents(input?.amount);

  if (
    !input ||
    typeof input.orderId !== "string" ||
    !customerName ||
    !recipientName ||
    !deliveryMethod ||
    !Number.isInteger(personCount) ||
    personCount < 1 ||
    personCount > 20 ||
    amountCents === undefined ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    typeof input.delivered !== "boolean" ||
    typeof input.paid !== "boolean" ||
    typeof input.photographed !== "boolean"
  ) {
    return { ok: false as const, message: "Invalid gift card order data." };
  }

  const session = await requireAdmin();
  const result = await prisma.giftCardOrder.updateMany({
    where: { id: input.orderId, adminId: ownerAdminId(session) },
    data: {
      customerName,
      email: email || null,
      recipientName,
      personCount,
      deliveryMethod,
      deliveryAddress: optionalText(input.deliveryAddress, 1000),
      amountCents,
      invoiceNumber: optionalText(input.invoiceNumber, 200),
      message: optionalText(input.message, 4000),
      delivered: input.delivered,
      paid: input.paid,
      photographed: input.photographed
    }
  });

  if (result.count !== 1) {
    return { ok: false as const, message: "Gift card order not found." };
  }

  revalidatePath("/admin/gift-card-orders");
  return { ok: true as const };
}

export async function deleteGiftCardOrder(orderId: string) {
  if (typeof orderId !== "string" || !orderId) {
    return { ok: false as const, message: "Invalid gift card order." };
  }

  const session = await requireAdmin();
  const result = await prisma.giftCardOrder.deleteMany({
    where: { id: orderId, adminId: ownerAdminId(session) }
  });

  if (result.count !== 1) {
    return { ok: false as const, message: "Gift card order not found." };
  }

  revalidatePath("/admin/gift-card-orders");
  return { ok: true as const };
}
