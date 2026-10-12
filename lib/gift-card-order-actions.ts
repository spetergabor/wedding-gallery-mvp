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
