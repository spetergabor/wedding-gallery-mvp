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
  return `irm_${randomBytes(32).toString("base64url")}`;
}

export function createIrisMomentDeviceToken() {
  return `irmd_${randomBytes(32).toString("base64url")}`;
}

export function readIrisRetouchToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return normalizeIrisRetouchToken(authorization.slice(7));
}

export async function authenticateIrisRetouch(request: NextRequest) {
  const token = readIrisRetouchToken(request);
  if (!token) return null;
  const tokenHash = hashIrisRetouchToken(token);
  const integration = await prisma.irisRetouchIntegration.findUnique({
    where: { tokenHash },
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
  if (integration) {
    if (!integration.lastUsedAt || Date.now() - integration.lastUsedAt.getTime() > 60_000) {
      await prisma.irisRetouchIntegration.update({
        where: { id: integration.id },
        data: { lastUsedAt: new Date() }
      });
    }
    const legacyDevice = await touchLegacyDevice(request, integration.adminId);
    if (legacyDevice.blocked) return null;
    return { ...integration, device: legacyDevice.device };
  }

  const device = await prisma.irisMomentDevice.findUnique({
    where: { tokenHash },
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
  if (!device || device.revokedAt) return null;
  if (Date.now() - device.lastSeenAt.getTime() > 15_000) {
    await prisma.irisMomentDevice.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        name: request.headers.get("x-irismoment-device-name")?.trim().slice(0, 120) || device.name,
        appVersion: request.headers.get("x-irismoment-app-version")?.trim().slice(0, 50) || device.appVersion
      }
    });
  }
  return {
    id: device.id,
    adminId: device.adminId,
    tokenHash: device.tokenHash ?? tokenHash,
    createdAt: device.createdAt,
    lastUsedAt: device.lastSeenAt,
    admin: device.admin,
    device
  };
}

async function touchLegacyDevice(request: NextRequest, adminId: string) {
  const externalId = request.headers.get("x-irismoment-device-id")?.trim().slice(0, 100);
  if (!externalId) return { device: null, blocked: false };
  const name = request.headers.get("x-irismoment-device-name")?.trim().slice(0, 120) || "irismoment eszköz";
  const appVersion = request.headers.get("x-irismoment-app-version")?.trim().slice(0, 50) || null;
  const existing = await prisma.irisMomentDevice.findUnique({
    where: { adminId_externalId: { adminId, externalId } }
  });
  if (existing?.revokedAt) return { device: existing, blocked: true };
  const device = await prisma.irisMomentDevice.upsert({
    where: { adminId_externalId: { adminId, externalId } },
    create: { adminId, externalId, name, appVersion, lastSeenAt: new Date() },
    update: { name, appVersion, lastSeenAt: new Date() }
  });
  return { device, blocked: false };
}
