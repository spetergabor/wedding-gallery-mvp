import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Images } from "lucide-react";
import { CustomerAccountShell } from "@/components/customer-account-shell";
import { CustomerGuestGalleryManager } from "@/components/customer-guest-gallery-manager";
import {
  CUSTOMER_GUEST_PHOTO_PAGE_SIZE,
  serializeCustomerGuestPhoto,
  type CustomerGuestPhotoStatusFilter
} from "@/lib/customer-guest-gallery";
import { requireCustomerPortalSession } from "@/lib/customer-portal-auth";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_GUEST } from "@/lib/proofing";

export default async function CustomerGuestGalleryPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const [session, { id }] = await Promise.all([requireCustomerPortalSession(), params]);
  const customer = session.account.customer;
  const german = customer.preferredLanguage !== "hu";
  const gallery = await prisma.gallery.findFirst({
    where: {
      id,
      customerId: customer.id,
      galleryMode: GALLERY_MODE_GUEST
    },
    select: {
      id: true,
      title: true,
      slug: true,
      guestUploads: {
        where: { customerDeletedAt: null, status: { not: "pending" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: CUSTOMER_GUEST_PHOTO_PAGE_SIZE + 1,
        select: {
          id: true,
          filename: true,
          email: true,
          guestName: true,
          imageUrl: true,
          thumbnailUrl: true,
          previewUrl: true,
          fileSize: true,
          status: true,
          processingStatus: true,
          customerDeletedAt: true,
          createdAt: true
        }
      }
    }
  });

  if (!gallery) notFound();

  const [activeCount, statusGroups, trashCount] = await Promise.all([
    prisma.galleryGuestUpload.count({ where: { galleryId: gallery.id, customerDeletedAt: null, status: { not: "pending" } } }),
    prisma.galleryGuestUpload.groupBy({
      by: ["status"],
      where: { galleryId: gallery.id, customerDeletedAt: null },
      _count: { _all: true }
    }),
    prisma.galleryGuestUpload.count({ where: { galleryId: gallery.id, customerDeletedAt: { not: null } } })
  ]);
  const groupedCounts = new Map(statusGroups.map((group) => [group.status, group._count._all]));
  const statusCounts: Record<CustomerGuestPhotoStatusFilter, number> = {
    all: activeCount,
    pending_review: groupedCounts.get("pending_review") ?? 0,
    visible: groupedCounts.get("visible") ?? 0,
    hidden: groupedCounts.get("hidden") ?? 0,
    trash: trashCount
  };
  const initialRows = gallery.guestUploads.slice(0, CUSTOMER_GUEST_PHOTO_PAGE_SIZE);
  const lastPhoto = initialRows.at(-1);
  const initialNextCursor = gallery.guestUploads.length > CUSTOMER_GUEST_PHOTO_PAGE_SIZE && lastPhoto
    ? { createdAt: lastPhoto.createdAt.toISOString(), id: lastPhoto.id }
    : null;

  return (
    <CustomerAccountShell coupleName={customer.coupleName} displayName={session.account.displayName} language={customer.preferredLanguage}>
      <div className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <Link href="/portal/account" className="inline-flex items-center gap-1.5 text-sm font-medium text-graphite/70 hover:text-ink">
              <ArrowLeft size={15} /> {german ? "Gästegalerien" : "Vendéggalériák"}
            </Link>
            <p className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-brass"><Images size={14} /> {german ? "Fotoverwaltung" : "Fotókezelés"}</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">{gallery.title}</h1>
            <p className="mt-2 text-sm leading-6 text-graphite/65">
              {german
                ? "Ein Klick markiert ein Foto. Danach könnt ihr mehrere Bilder gemeinsam freigeben, ausblenden oder in den Papierkorb verschieben."
                : "Kattintással jelöljetek ki fotókat, majd egyszerre jóváhagyhatjátok, elrejthetitek vagy lomtárba tehetitek őket."}
            </p>
          </div>
          <Link href={`/g/${gallery.slug}`} target="_blank" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink hover:bg-paper">
            <ExternalLink size={15} /> {german ? "Galerie ansehen" : "Galéria megnyitása"}
          </Link>
        </div>

        <CustomerGuestGalleryManager
          galleryId={gallery.id}
          language={customer.preferredLanguage}
          initialPhotos={initialRows.map(serializeCustomerGuestPhoto)}
          initialNextCursor={initialNextCursor}
          initialTotalCount={activeCount}
          statusCounts={statusCounts}
        />
      </div>
    </CustomerAccountShell>
  );
}
