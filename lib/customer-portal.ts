import { randomBytes } from "node:crypto";

export function createCustomerPortalToken() {
  return randomBytes(32).toString("base64url");
}
