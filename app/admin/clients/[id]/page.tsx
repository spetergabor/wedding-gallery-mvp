import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Camera, CheckCircle2, ExternalLink, Heart, Mail, Plus, Trash2, Upload } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { ButtonLink } from "@/components/button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ContractManager } from "@/components/contract-manager";
import { CustomerForm, CustomerProfileCard } from "@/components/customer-form";
import { requireAdmin } from "@/lib/auth";
import { customerAccessWhere } from "@/lib/admin-scope";
import { customerStatusLabel, customerTypeLabel } from "@/lib/customer-options";
import { deleteCustomerAction } from "@/lib/customer-actions";
import { prisma } from "@/lib/prisma";
import {
  GALLERY_MODE_PROOFING,
  PHOTO_DELIVERY_STAGE_FINAL,
  PROOFING_STATUS_DELIVERED,
  PROOFING_STATUS_IN_PROGRESS,
  PROOFING_STATUS_NOT_OPENED,
  PROOFING_STATUS_PROCESSING,
  PROOFING_STATUS_SUBMITTED
} from "@/lib/proofing";

function formatDate(date: Date | null) {
  if (!date) {
    return "Nincs dátum megadva";
  }

  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

type CustomerGallerySummary = {
  id: string;
  title: string;
  galleryMode: string;
  proofingStatus: string;
  clientEmail: string | null;
  proofingInviteSentAt: Date | null;
  finalDeliveryEmailSentAt: Date | null;
  _count: {
    photos: number;
  };
  photos: Array<{
    id: string;
  }>;
};

function getNextCustomerAction(customer: { id: string; galleries: CustomerGallerySummary[] }) {
  const latestGallery = customer.galleries[0] ?? null;
  const proofingGallery = customer.galleries.find(
    (gallery) => gallery.galleryMode === GALLERY_MODE_PROOFING && gallery.proofingStatus !== PROOFING_STATUS_DELIVERED
  );
  const finishedProofingGallery = customer.galleries.find(
    (gallery) => gallery.galleryMode === GALLERY_MODE_PROOFING && gallery.proofingStatus === PROOFING_STATUS_DELIVERED
  );

  if (!latestGallery) {
    return {
      icon: Plus,
      title: "Első galéria létrehozása",
      description: "Az ügyfél megvan. A következő lépés egy galéria vagy nyers válogatás indítása ehhez az ügyfélhez.",
      href: `/admin/galleries/new?customerId=${customer.id}`,
      buttonLabel: "Új galéria"
    };
  }

  if (latestGallery._count.photos === 0) {
    return {
      icon: Upload,
      title: "Képek feltöltése",
      description: `${latestGallery.title} már létrejött, de még nincs benne fotó. Innen érdemes folytatni a munkát.`,
      href: `/admin/galleries/${latestGallery.id}?tab=photos`,
      buttonLabel: "Feltöltés megnyitása"
    };
  }

  if (proofingGallery?.proofingStatus === PROOFING_STATUS_SUBMITTED) {
    const hasFinalPhotos = proofingGallery.photos.length > 0;

    return {
      icon: hasFinalPhotos ? CheckCircle2 : Upload,
      title: hasFinalPhotos ? "Kész képek átadása" : "Kész képek feltöltése",
      description: hasFinalPhotos
        ? "Az ügyfél leadta a válogatást, és már van kész kép feltöltve. A következő lépés az átadás emaillel."
        : "Az ügyfél leadta a válogatást. Most a kidolgozott képeket töltsd vissza ugyanebbe a galériába.",
      href: `/admin/galleries/${proofingGallery.id}?tab=client`,
      buttonLabel: hasFinalPhotos ? "Átadás kezelése" : "Kész képek feltöltése"
    };
  }

  if (proofingGallery?.proofingStatus === PROOFING_STATUS_PROCESSING) {
    const hasFinalPhotos = proofingGallery.photos.length > 0;

    return {
      icon: hasFinalPhotos ? CheckCircle2 : Upload,
      title: hasFinalPhotos ? "Kész képek átadása" : "Kidolgozás folyamatban",
      description: hasFinalPhotos
        ? "A galéria feldolgozás alatt van, és már van kész anyag. Innen tudod lezárni és elküldeni az ügyfélnek."
        : "A válogatás feldolgozás alatt van jelölve. Ha elkészültek a képek, ide töltsd fel őket.",
      href: `/admin/galleries/${proofingGallery.id}?tab=client`,
      buttonLabel: hasFinalPhotos ? "Átadás megnyitása" : "Kész képek feltöltése"
    };
  }

  if (
    proofingGallery?.proofingStatus === PROOFING_STATUS_NOT_OPENED ||
    proofingGallery?.proofingStatus === PROOFING_STATUS_IN_PROGRESS
  ) {
    return {
      icon: proofingGallery.proofingInviteSentAt ? Heart : Mail,
      title: proofingGallery.proofingInviteSentAt ? "Válogatás követése" : "Válogató link kiküldése",
      description: proofingGallery.proofingInviteSentAt
        ? "A nyers válogató link már ki lett küldve. Itt látod, hogy az ügyfél hol tart a kiválasztással."
        : "A nyers képes galéria készen áll. A következő lépés a válogató link emailes kiküldése.",
      href: `/admin/galleries/${proofingGallery.id}?tab=client`,
      buttonLabel: proofingGallery.proofingInviteSentAt ? "Válogatás megnyitása" : "Link küldése"
    };
  }

  if (finishedProofingGallery) {
    return {
      icon: CheckCircle2,
      title: "Kész képek átadva",
      description: finishedProofingGallery.finalDeliveryEmailSentAt
        ? "A kész galéria átadás emailje már ki lett küldve. Innen visszanézheted vagy újraküldheted."
        : "A kész galéria átadott státuszban van. Ellenőrizheted az átadás email állapotát.",
      href: `/admin/galleries/${finishedProofingGallery.id}?tab=client`,
      buttonLabel: "Átadás megnyitása"
    };
  }

  return {
    icon: Camera,
    title: "Galéria kezelése",
    description: "Van aktív galéria ehhez az ügyfélhez. Itt tudod folytatni a feltöltést, beállításokat vagy átadást.",
    href: `/admin/galleries/${latestGallery.id}`,
    buttonLabel: "Galéria megnyitása"
  };
}

export default async function AdminClientDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    error?: string;
    contractUploaded?: string;
    contractWritten?: string;
    contractSent?: string;
    contractError?: string;
    edit?: string;
  }>;
}) {
  const admin = await requireAdmin();
  const [{ id }, flags] = await Promise.all([params, searchParams]);
  const customer = await prisma.customer.findFirst({
    where: customerAccessWhere(admin, id),
    include: {
      contracts: {
        orderBy: { createdAt: "desc" }
      },
      galleries: {
        orderBy: { createdAt: "desc" },
        include: {
          photos: {
            where: { deliveryStage: PHOTO_DELIVERY_STAGE_FINAL },
            select: { id: true },
            take: 1
          },
          _count: {
            select: { photos: true }
          }
        }
      }
    }
  });

  if (!customer) {
    notFound();
  }

  const isEditing = flags.edit === "1";
  const typeLabel = customerTypeLabel(customer.customerType);
  const nextAction = getNextCustomerAction(customer);
  const NextActionIcon = nextAction.icon;

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.24em] text-brass">Ügyfél</p>
        <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-4xl font-semibold text-ink">{customer.coupleName}</h1>
            <p className="mt-3 text-sm text-graphite/70">
              {typeLabel} · {customerStatusLabel(customer.status)} · {formatDate(customer.weddingDate)}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5 space-y-3">
        {flags.created ? <Alert title="Ügyfél létrehozva." variant="success" /> : null}
        {flags.updated ? <Alert title="Ügyfél mentve." variant="success" /> : null}
        {flags.contractUploaded ? <Alert title="Szerződés feltöltve." variant="success" /> : null}
        {flags.contractWritten ? <Alert title="Saját szerződés létrehozva." variant="success" /> : null}
        {flags.contractSent ? <Alert title="Szerződés elküldve emailben." variant="success" /> : null}
        {flags.error === "missing" ? (
          <Alert title="Hiányzó kötelező mező." variant="error">
            Az ügyfél/projekt neve és az elsődleges email cím kötelező.
          </Alert>
        ) : null}
        {flags.contractError === "missing" ? (
          <Alert title="Hiányzó szerződés adat." variant="error">
            Adj meg címet és válassz ki egy PDF fájlt.
          </Alert>
        ) : null}
        {flags.contractError === "type" ? (
          <Alert title="Csak PDF tölthető fel." variant="error">
            A szerződés első verzióban PDF fájl lehet.
          </Alert>
        ) : null}
        {flags.contractError === "written-missing" ? (
          <Alert title="Hiányzó szerződés szöveg." variant="error">
            Adj meg címet és szerződés szöveget.
          </Alert>
        ) : null}
        {flags.contractError === "not-found" ? (
          <Alert title="A szerződés nem található." variant="error">
            Frissítsd az oldalt, és próbáld újra.
          </Alert>
        ) : null}
      </div>

      <section className="mb-6 rounded-lg border border-brass/25 bg-brass/10 p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white text-brass shadow-sm">
              <NextActionIcon size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-brass">Következő teendő</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">{nextAction.title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-graphite/75">{nextAction.description}</p>
            </div>
          </div>
          <ButtonLink href={nextAction.href} className="shrink-0">
            {nextAction.buttonLabel}
            <ArrowRight size={16} />
          </ButtonLink>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {isEditing ? <CustomerForm customer={customer} /> : <CustomerProfileCard customer={customer} />}
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
                  <Camera size={15} />
                  Galériák
                </div>
                <h2 className="mt-2 text-xl font-semibold text-ink">Ügyfélhez tartozó galériák</h2>
                <p className="mt-1 text-sm leading-6 text-graphite/70">
                  Innen induljon az új feltöltés. Így a galéria, a válogatás, az átadás és a szerződések egy ügyfél alatt maradnak.
                </p>
              </div>
              <ButtonLink href={`/admin/galleries/new?customerId=${customer.id}`}>
                <Plus size={16} />
                Új galéria
              </ButtonLink>
            </div>

            {customer.galleries.length === 0 ? (
              <div className="mt-5 rounded-md bg-paper px-4 py-4">
                <p className="text-sm font-medium text-ink">Még nincs galéria ehhez az ügyfélhez</p>
                <p className="mt-1 text-sm text-graphite/70">Hozd létre az első galériát, majd ott tudod feltölteni a képeket.</p>
              </div>
            ) : (
              <div className="mt-5 divide-y divide-ink/10 rounded-md border border-ink/10">
                {customer.galleries.map((gallery) => (
                  <div key={gallery.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <Link href={`/admin/galleries/${gallery.id}`} className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{gallery.title}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${gallery.isActive ? "bg-sage/15 text-sage" : "bg-ink/5 text-graphite"}`}>
                          {gallery.isActive ? "Aktív" : "Archivált"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-graphite/70">/g/{gallery.slug} · {gallery._count.photos} média</p>
                    </Link>
                    <div className="flex items-center gap-2">
                      <ButtonLink href={`/admin/galleries/${gallery.id}`} variant="secondary" className="h-10">
                        Kezelés
                      </ButtonLink>
                      <a className="flex size-10 items-center justify-center rounded-md border border-ink/10 hover:bg-ink/5" href={`/g/${gallery.slug}`} target="_blank">
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <ContractManager customerId={customer.id} contracts={customer.contracts} />
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Gyors adatok</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-graphite/60">Típus</dt>
                <dd className="font-medium text-ink">{typeLabel}</dd>
              </div>
              <div>
                <dt className="text-graphite/60">Elsődleges email</dt>
                <dd className="font-medium text-ink">{customer.primaryEmail}</dd>
              </div>
              <div>
                <dt className="text-graphite/60">Másodlagos email</dt>
                <dd className="font-medium text-ink">{customer.secondaryEmail || "Nincs megadva"}</dd>
              </div>
              <div>
                <dt className="text-graphite/60">Telefon</dt>
                <dd className="font-medium text-ink">{customer.phone || "Nincs megadva"}</dd>
              </div>
              <div>
                <dt className="text-graphite/60">Helyszín</dt>
                <dd className="font-medium text-ink">{customer.venue || "Nincs megadva"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-red-200 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Veszélyzóna</h2>
            <p className="mt-2 text-sm leading-6 text-graphite/70">
              Az ügyfél törlése eltávolítja az adatlapot és a hozzá tartozó szerződés rekordokat. A galériák megmaradnak,
              de ügyfél nélküli régi galériaként folytatják. A művelet nem vonható vissza.
            </p>
            <form action={deleteCustomerAction.bind(null, customer.id)} className="mt-4">
              <ConfirmSubmitButton
                variant="danger"
                message={`Biztosan törlöd ezt az ügyfelet: ${customer.coupleName}? Ez nem vonható vissza.`}
                className="w-full"
              >
                <Trash2 size={16} />
                Ügyfél törlése
              </ConfirmSubmitButton>
            </form>
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}
