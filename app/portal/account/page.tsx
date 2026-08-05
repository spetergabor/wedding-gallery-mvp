import Link from "next/link";
import { Archive, Camera, ChevronRight, ImageIcon, UploadCloud } from "lucide-react";
import { Alert } from "@/components/alert";
import { CustomerAccountShell } from "@/components/customer-account-shell";
import { requireCustomerPortalSession } from "@/lib/customer-portal-auth";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_GUEST } from "@/lib/proofing";

export default async function CustomerPortalAccountPage({
  searchParams
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const [session, params] = await Promise.all([requireCustomerPortalSession(), searchParams]);
  const customer = session.account.customer;
  const german = customer.preferredLanguage !== "hu";
  const galleries = await prisma.gallery.findMany({
    where: {
      customerId: customer.id,
      galleryMode: GALLERY_MODE_GUEST
    },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      isActive: true,
      guestUploadsEnabled: true,
      guestGalleryArchivedAt: true,
      guestGalleryExpiresAt: true,
      _count: {
        select: {
          guestUploads: { where: { customerDeletedAt: null, status: { not: "pending" } } }
        }
      }
    }
  });

  return (
    <CustomerAccountShell coupleName={customer.coupleName} displayName={session.account.displayName} language={customer.preferredLanguage}>
      <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        {params.password === "changed" ? (
          <div className="mb-5"><Alert title={german ? "Euer persönliches Passwort wurde gespeichert." : "A saját jelszavatok elmentve."} variant="success" /></div>
        ) : null}

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">{german ? "Eure Gästegalerien" : "Vendéggalériáitok"}</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{german ? "Fotos gemeinsam verwalten" : "Fotók közös kezelése"}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite/70">
            {german
              ? "Hier könnt ihr hochgeladene Gästefotos prüfen, ausblenden, freigeben oder in den Papierkorb verschieben."
              : "Itt átnézhetitek, elrejthetitek, jóváhagyhatjátok vagy lomtárba helyezhetitek a vendégek fotóit."}
          </p>
        </div>

        {galleries.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-ink/15 bg-white px-6 py-12 text-center">
            <Camera size={28} className="mx-auto text-graphite/45" />
            <h2 className="mt-4 text-lg font-semibold text-ink">{german ? "Noch keine zugewiesene Gästegalerie" : "Még nincs hozzárendelt vendéggaléria"}</h2>
            <p className="mt-2 text-sm text-graphite/65">{german ? "Euer Fotograf kann die Galerie mit eurem Kundenprofil verbinden." : "A fotósotok az ügyfélprofilotokhoz tudja kapcsolni a galériát."}</p>
          </div>
        ) : (
          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            {galleries.map((gallery) => {
              const archived = Boolean(gallery.guestGalleryArchivedAt) || Boolean(gallery.guestGalleryExpiresAt && gallery.guestGalleryExpiresAt <= new Date());

              return (
                <article key={gallery.id} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid size-11 shrink-0 place-items-center rounded-md bg-ink text-white"><ImageIcon size={20} /></span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${archived ? "bg-ink/10 text-graphite" : gallery.guestUploadsEnabled ? "bg-sage/10 text-sage" : "bg-brass/10 text-brass"}`}>
                      {archived ? <Archive size={11} /> : <UploadCloud size={11} />}
                      {archived ? (german ? "Archiviert" : "Archivált") : gallery.guestUploadsEnabled ? (german ? "Upload offen" : "Feltöltés nyitva") : (german ? "Upload geschlossen" : "Feltöltés lezárva")}
                    </span>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold text-ink">{gallery.title}</h2>
                  <p className="mt-2 text-sm text-graphite/65">{gallery._count.guestUploads} {german ? "Fotos" : "fotó"}</p>
                  <div className="mt-5 flex flex-col gap-2 border-t border-ink/10 pt-4 sm:flex-row">
                    <Link href={`/portal/account/guest-galleries/${gallery.id}`} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-graphite">
                      {german ? "Fotos verwalten" : "Fotók kezelése"} <ChevronRight size={16} />
                    </Link>
                    {!archived && gallery.isActive ? (
                      <Link href={`/g/${gallery.slug}`} target="_blank" className="inline-flex h-11 items-center justify-center rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink hover:bg-paper">
                        {german ? "Galerie ansehen" : "Galéria megnyitása"}
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </CustomerAccountShell>
  );
}
