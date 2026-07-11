export const PAID_PURCHASE_SCOPE_PREFIX = "paid_purchase:";

export function paidPurchaseScope(purchaseId: string) {
  return `${PAID_PURCHASE_SCOPE_PREFIX}${purchaseId}`;
}

export function isPaidPurchaseScope(scope: string | null | undefined) {
  return Boolean(scope?.startsWith(PAID_PURCHASE_SCOPE_PREFIX));
}

export function paidPurchaseIdFromScope(scope: string | null | undefined) {
  return isPaidPurchaseScope(scope) ? scope!.slice(PAID_PURCHASE_SCOPE_PREFIX.length) : null;
}
