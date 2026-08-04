import QRCode from "qrcode";
import Link from "next/link";
import { PrintPageButton } from "@/components/print-page-button";
import { galleryAccessWhere, ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { publicGalleryUrl } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_GUEST } from "@/lib/proofing";

export default async function GuestGalleryPrintPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const [gallery, siteSettings] = await Promise.all([
    prisma.gallery.findFirst({
      where: {
        ...galleryAccessWhere(admin, id),
        galleryMode: GALLERY_MODE_GUEST
      },
      select: {
        id: true,
        title: true,
        slug: true,
        customer: {
          select: { preferredLanguage: true }
        }
      }
    }),
    prisma.siteSettings.findUnique({
      where: { adminId: ownerAdminId(admin) },
      select: {
        publicSubdomain: true,
        businessName: true
      }
    })
  ]);

  if (!gallery) {
    return <main className="p-8">A vendéggaléria nem található.</main>;
  }

  const publicUrl = publicGalleryUrl(
    gallery.slug,
    gallery.customer?.preferredLanguage,
    siteSettings?.publicSubdomain
  );
  const guestUrl = `${publicUrl}#guest-photos`;
  const cardLanguage = gallery.customer?.preferredLanguage === "hu" ? "hu" : "de";
  const cardText =
    cardLanguage === "hu"
      ? "Te is készítettél képeket? Töltsd fel, és nézd meg a vendégek közös pillanatait!"
      : "Du hast auch Fotos gemacht? Lade sie hoch und entdecke die gemeinsamen Momente aller Gäste!";
  const qrCodeDataUrl = await QRCode.toDataURL(guestUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 360,
    color: { dark: "#111111", light: "#ffffff" }
  });
  const shortUrl = new URL(publicUrl).host + new URL(publicUrl).pathname;

  return (
    <main className="min-h-screen bg-paper px-5 py-6 text-ink print:bg-white print:p-0">
      <div className="mx-auto mb-6 flex max-w-[190mm] items-center justify-between gap-4 print:hidden">
        <div>
          <Link href={`/admin/guest-galleries/${gallery.id}`} className="text-sm font-medium text-graphite/70 hover:text-ink">
            ← Vissza a vendéggalériához
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Nyomtatható QR-kártyák</h1>
          <p className="mt-1 text-sm text-graphite/65">A4-es lapon 8 darab, 85 × 55 mm-es kártya.</p>
        </div>
        <PrintPageButton label="Kártyák nyomtatása" />
      </div>

      <section className="mx-auto grid w-fit grid-cols-2 gap-[5mm] print:gap-[5mm]">
        {Array.from({ length: 8 }, (_, index) => (
          <article
            key={index}
            className="flex overflow-hidden rounded-[3mm] border border-ink/15 bg-white p-[5mm] shadow-soft print:break-inside-avoid print:shadow-none"
            style={{ width: "85mm", height: "55mm" }}
          >
            <div className="flex min-w-0 flex-1 flex-col pr-[3mm]">
              <p className="text-[7pt] font-semibold uppercase tracking-[0.14em] text-graphite/55">
                {siteSettings?.businessName || "Spetly"}
              </p>
              <h2 className="mt-[2mm] line-clamp-2 text-[13pt] font-semibold leading-tight">{gallery.title}</h2>
              <p className="mt-[2mm] text-[8pt] leading-[1.35] text-graphite/70">
                {cardText}
              </p>
              <p className="mt-auto truncate text-[6.5pt] font-medium text-graphite/55">{shortUrl}</p>
            </div>
            <div className="flex w-[31mm] shrink-0 items-center justify-center">
              <img src={qrCodeDataUrl} alt="Vendéggaléria QR-kód" className="h-[29mm] w-[29mm]" />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
