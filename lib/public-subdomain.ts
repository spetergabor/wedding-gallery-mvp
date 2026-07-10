import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSlug } from "@/lib/slug";

const PUBLIC_SUBDOMAIN_MAX_LENGTH = 40;

export const RESERVED_PUBLIC_SUBDOMAINS = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "blog",
  "cdn",
  "dashboard",
  "help",
  "mail",
  "smtp",
  "spetly",
  "static",
  "support",
  "www"
]);

export function normalizePublicSubdomain(value: string) {
  return normalizeSlug(value).slice(0, PUBLIC_SUBDOMAIN_MAX_LENGTH);
}

export function isValidPublicSubdomain(value: string) {
  return value.length >= 3 && !RESERVED_PUBLIC_SUBDOMAINS.has(value);
}

function fallbackName(name: string, email?: string | null) {
  const normalizedName = normalizePublicSubdomain(name);

  if (normalizedName) {
    return normalizedName;
  }

  const emailName = email?.split("@")[0] ?? "";
  const normalizedEmailName = normalizePublicSubdomain(emailName);

  return normalizedEmailName || "fotograf";
}

function defaultCandidate(base: string, attempt: number) {
  const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
  const truncatedBase = base.slice(0, PUBLIC_SUBDOMAIN_MAX_LENGTH - suffix.length);
  const candidate = `${truncatedBase}${suffix}`;

  if (isValidPublicSubdomain(candidate)) {
    return candidate;
  }

  const safeBase = `foto-${base}`.slice(0, PUBLIC_SUBDOMAIN_MAX_LENGTH - suffix.length);
  return `${safeBase}${suffix}`;
}

function isUniqueSubdomainError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

type AdminSubdomainInput = {
  id: string;
  name: string;
  email?: string | null;
  role: string;
};

export async function ensureDefaultPublicSubdomainForAdmin(admin: AdminSubdomainInput) {
  if (admin.role === "super_admin") {
    return null;
  }

  const existingSettings = await prisma.siteSettings.findUnique({
    where: { adminId: admin.id },
    select: { id: true, publicSubdomain: true }
  });

  if (existingSettings?.publicSubdomain) {
    return existingSettings.publicSubdomain;
  }

  const base = fallbackName(admin.name, admin.email);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const publicSubdomain = defaultCandidate(base, attempt);

    try {
      if (existingSettings) {
        await prisma.siteSettings.update({
          where: { id: existingSettings.id },
          data: { publicSubdomain }
        });
      } else {
        await prisma.siteSettings.create({
          data: {
            id: admin.id,
            adminId: admin.id,
            businessName: "",
            publicSubdomain
          }
        });
      }

      return publicSubdomain;
    } catch (error) {
      if (isUniqueSubdomainError(error)) {
        continue;
      }

      throw error;
    }
  }

  const fallback = defaultCandidate(`${base}-${admin.id.slice(-8)}`, 0);

  if (existingSettings) {
    await prisma.siteSettings.update({
      where: { id: existingSettings.id },
      data: { publicSubdomain: fallback }
    });
  } else {
    await prisma.siteSettings.create({
      data: {
        id: admin.id,
        adminId: admin.id,
        businessName: "",
        publicSubdomain: fallback
      }
    });
  }

  return fallback;
}
