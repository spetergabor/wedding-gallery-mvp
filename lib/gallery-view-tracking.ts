import { prisma } from "@/lib/prisma";

function cleanHeader(value: string | null, maxLength = 240) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function decodeLocationHeader(value: string | null) {
  const cleaned = cleanHeader(value, 120);

  if (!cleaned) {
    return null;
  }

  try {
    return decodeURIComponent(cleaned.replace(/\+/g, " "));
  } catch {
    return cleaned;
  }
}

export async function recordGalleryView({
  galleryId,
  headers
}: {
  galleryId: string;
  headers: Headers;
}) {
  const country = decodeLocationHeader(headers.get("x-vercel-ip-country"));
  const region = decodeLocationHeader(headers.get("x-vercel-ip-country-region"));
  const city = decodeLocationHeader(headers.get("x-vercel-ip-city"));
  const referrer = cleanHeader(headers.get("referer") ?? headers.get("referrer"), 500);
  const userAgent = cleanHeader(headers.get("user-agent"), 500);

  await prisma.galleryView.create({
    data: {
      galleryId,
      country,
      region,
      city,
      referrer,
      userAgent
    }
  });
}
