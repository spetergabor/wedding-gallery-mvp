import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
  identifier?: string | null;
};

export type RateLimitResult = {
  limited: boolean;
  retryAfterSeconds: number;
  limit: number;
  remaining: number;
};

const CLEANUP_SAMPLE_RATE = 0.02;
const MAX_IDENTIFIER_LENGTH = 320;

function hashIdentifier(value: string) {
  const secret = process.env.RATE_LIMIT_HASH_SECRET ?? process.env.AUTH_SECRET ?? "dev-rate-limit-secret";
  return createHash("sha256").update(secret).update("|").update(value).digest("hex");
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function readClientIp(headerStore: Headers) {
  return (
    firstHeaderValue(headerStore.get("cf-connecting-ip")) ??
    firstHeaderValue(headerStore.get("x-real-ip")) ??
    firstHeaderValue(headerStore.get("x-forwarded-for")) ??
    firstHeaderValue(headerStore.get("x-vercel-forwarded-for")) ??
    "unknown"
  );
}

function normalizeIdentifier(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_IDENTIFIER_LENGTH);
}

function retryAfterSeconds(resetAt: Date, now: Date) {
  return Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
}

async function cleanupExpiredBuckets(now: Date) {
  if (Math.random() > CLEANUP_SAMPLE_RATE) {
    return;
  }

  await prisma.rateLimitBucket.deleteMany({
    where: {
      resetAt: { lt: now }
    }
  });
}

export async function consumeRateLimit({ scope, limit, windowSeconds, identifier }: RateLimitOptions): Promise<RateLimitResult> {
  if (limit <= 0 || windowSeconds <= 0) {
    return { limited: false, retryAfterSeconds: 0, limit, remaining: Math.max(0, limit) };
  }

  try {
    const headerStore = await headers();
    const ip = readClientIp(headerStore);
    const normalizedIdentifier = normalizeIdentifier(identifier);
    const identifierHash = hashIdentifier(`${ip}|${normalizedIdentifier || "anonymous"}`);
    const now = new Date();
    const nextResetAt = new Date(now.getTime() + windowSeconds * 1000);

    await cleanupExpiredBuckets(now);

    return await prisma.$transaction(async (tx) => {
      const bucket = await tx.rateLimitBucket.findUnique({
        where: {
          scope_identifierHash: {
            scope,
            identifierHash
          }
        },
        select: {
          id: true,
          count: true,
          resetAt: true
        }
      });

      if (!bucket || bucket.resetAt <= now) {
        await tx.rateLimitBucket.upsert({
          where: {
            scope_identifierHash: {
              scope,
              identifierHash
            }
          },
          create: {
            scope,
            identifierHash,
            count: 1,
            resetAt: nextResetAt
          },
          update: {
            count: 1,
            resetAt: nextResetAt
          }
        });

        return {
          limited: false,
          retryAfterSeconds: 0,
          limit,
          remaining: Math.max(0, limit - 1)
        };
      }

      if (bucket.count >= limit) {
        return {
          limited: true,
          retryAfterSeconds: retryAfterSeconds(bucket.resetAt, now),
          limit,
          remaining: 0
        };
      }

      const updated = await tx.rateLimitBucket.update({
        where: { id: bucket.id },
        data: { count: { increment: 1 } },
        select: { count: true }
      });

      return {
        limited: false,
        retryAfterSeconds: 0,
        limit,
        remaining: Math.max(0, limit - updated.count)
      };
    });
  } catch (error) {
    console.error("Rate limit check failed", { scope, error });
    return { limited: false, retryAfterSeconds: 0, limit, remaining: limit };
  }
}

export async function isRateLimited(options: RateLimitOptions) {
  return (await consumeRateLimit(options)).limited;
}

export async function isAnyRateLimited(options: RateLimitOptions[]) {
  for (const option of options) {
    if (await isRateLimited(option)) {
      return true;
    }
  }

  return false;
}
