import { prisma } from "@/lib/prisma";

const VIEW_DEDUPE_WINDOW_MS = 1000 * 60 * 60 * 12;

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

function parseCoordinateHeader(value: string | null) {
  if (!value) {
    return null;
  }

  const coordinate = Number.parseFloat(value);

  return Number.isFinite(coordinate) ? coordinate : null;
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
  const latitude = parseCoordinateHeader(headers.get("x-vercel-ip-latitude"));
  const longitude = parseCoordinateHeader(headers.get("x-vercel-ip-longitude"));
  const referrer = cleanHeader(headers.get("referer") ?? headers.get("referrer"), 500);
  const userAgent = cleanHeader(headers.get("user-agent"), 500);
  const dedupeSince = new Date(Date.now() - VIEW_DEDUPE_WINDOW_MS);

  const recentView = await prisma.galleryView.findFirst({
    where: {
      galleryId,
      country,
      region,
      city,
      userAgent,
      createdAt: {
        gte: dedupeSince
      }
    },
    select: { id: true }
  });

  if (recentView) {
    return {
      created: false,
      viewId: recentView.id
    };
  }

  const view = await prisma.galleryView.create({
    data: {
      galleryId,
      country,
      region,
      city,
      latitude,
      longitude,
      referrer,
      userAgent
    }
  });

  return {
    created: true,
    viewId: view.id
  };
}
