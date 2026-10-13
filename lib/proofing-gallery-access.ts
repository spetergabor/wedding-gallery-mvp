import { createHmac, timingSafeEqual } from "node:crypto";

function proofingAccessSecret() {
  return process.env.AUTH_SECRET ?? "dev-auth-secret-change-me";
}

export function createProofingGalleryAccessToken(galleryId: string, slug: string) {
  return createHmac("sha256", proofingAccessSecret())
    .update(`proofing-gallery:${galleryId}:${slug}`)
    .digest("base64url");
}

export function verifyProofingGalleryAccessToken(
  galleryId: string,
  slug: string,
  token: string | null | undefined
) {
  if (!token) return false;

  const expected = Buffer.from(createProofingGalleryAccessToken(galleryId, slug));
  const actual = Buffer.from(token);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
