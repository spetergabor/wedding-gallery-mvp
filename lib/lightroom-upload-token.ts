import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function createLightroomUploadToken() {
  return `lr_${randomBytes(32).toString("base64url")}`;
}

export function hashLightroomUploadToken(token: string) {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function normalizeLightroomUploadToken(token: unknown) {
  return typeof token === "string" ? token.trim() : "";
}
