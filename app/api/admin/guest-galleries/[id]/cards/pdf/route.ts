import { getAdminSession } from "@/lib/auth";
import { galleryAccessWhere, ownerAdminId } from "@/lib/admin-scope";
import { publicGalleryUrl } from "@/lib/email";
import { createGuestGalleryCardsPdf } from "@/lib/guest-gallery-cards-pdf";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_GUEST } from "@/lib/proofing";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const [gallery, settings] = await Promise.all([
    prisma.gallery.findFirst({
      where: { ...galleryAccessWhere(admin, id), galleryMode: GALLERY_MODE_GUEST },
      select: { title: true, slug: true, customer: { select: { preferredLanguage: true } } }
    }),
    prisma.siteSettings.findUnique({ where: { adminId: ownerAdminId(admin) }, select: { publicSubdomain: true, businessName: true } })
  ]);
  if (!gallery) return new Response("Not found", { status: 404 });
  const bytes = await createGuestGalleryCardsPdf({
    title: gallery.title,
    businessName: settings?.businessName || "Spetly",
    publicUrl: publicGalleryUrl(gallery.slug, gallery.customer?.preferredLanguage, settings?.publicSubdomain),
    language: gallery.customer?.preferredLanguage
  });
  const filename = `${gallery.slug.replace(/[^a-zA-Z0-9_-]/g, "-")}-qr-kartyak.pdf`;
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store"
  } });
}
