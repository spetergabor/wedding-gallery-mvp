import { createHash, randomBytes } from "node:crypto";

export const PASSWORD_RESET_EXPIRES_MINUTES = 60;
const PASSWORD_RESET_TOKEN_BYTES = 32;

export function createPasswordResetToken() {
  return randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("base64url");
}

export function passwordResetTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function passwordResetExpiresAt() {
  return new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);
}
