import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const IRIS_FULFILLMENT_MODE = "iris_direct";
export const GALLERY_FULFILLMENT_MODE = "gallery";

export function normalizeIrisRetouchToken(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

export function hashIrisRetouchToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createIrisRetouchToken() {
  return `irt_${randomBytes(32).toString("base64url")}`;
}

export function readIrisRetouchToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return normalizeIrisRetouchToken(authorization.slice(7));
}

export async function authenticateIrisRetouch(request: NextRequest) {
  const token = readIrisRetouchToken(request);
  if (!token) return null;
  const integration = await prisma.irisRetouchIntegration.findUnique({
    where: { tokenHash: hashIrisRetouchToken(token) },
    include: {
      admin: {
        select: {
          id: true,
          name: true,
          email: true,
          siteSettings: { select: { businessName: true } }
        }
      }
    }
  });
  if (!integration) return null;
  if (!integration.lastUsedAt || Date.now() - integration.lastUsedAt.getTime() > 60_000) {
    await prisma.irisRetouchIntegration.update({
      where: { id: integration.id },
      data: { lastUsedAt: new Date() }
    });
  }
  return integration;
}
