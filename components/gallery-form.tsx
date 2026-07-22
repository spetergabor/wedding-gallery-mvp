import { CalendarDays, ExternalLink, Images, LockKeyhole, UploadCloud, UserRound } from "lucide-react";
import { createGalleryAction, updateGalleryAction } from "@/lib/gallery-actions";
import { customerProjectTypeLabel } from "@/lib/customer-project-options";
import { customerTypeLabel } from "@/lib/customer-options";
import { SlugFields } from "@/components/slug-fields";
import { GALLERY_MODE_FULL, GALLERY_MODE_PROOFING } from "@/lib/proofing";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  GALLERY_DELIVERY_FREE_DOWNLOAD,
  GALLERY_DELIVERY_PAID,
  GALLERY_DELIVERY_VIEW_ONLY,
  normalizeGalleryDeliveryMode
} from "@/lib/gallery-delivery";
import { normalizeSaleCurrency } from "@/lib/gallery-sales";
import { normalizeGallerySalePricingTiers } from "@/lib/gallery-sale-pricing";
import { GalleryPublishSettings } from "@/components/gallery-publish-settings";
import { CopyLinkButton } from "@/components/copy-link-button";

type CustomerOption = {
  id: string;
  customerType: string;
  coupleName: string;
  primaryEmail: string;
  weddingDate: Date | null;
};

type ProjectOption = {
  id: string;
  customerId: string;
  title: string;
  projectType: string;
  eventDate: Date | null;
  venue: string | null;
  customer: {
    coupleName: string;
  };
};

type GalleryFormProps = {
  gallery?: {
    id: string;
    customerId: string | null;
    projectId: string | null;
    title: string;
    slug: string;
    password: string | null;
    eventDate: Date | null;
    isActive: boolean;
    galleryMode: string;
    deliveryMode: string;
    salePriceCents: number;
    saleUnitPriceCents: number;
    salePricingTiers: unknown;
    saleCurrency: string;
    downloadsEnabled: boolean;
    guestUploadsEnabled: boolean;
    publicColumnCount: number;
    clientEmail: string | null;
  };
  customers?: CustomerOption[];
  projects?: ProjectOption[];
  selectedCustomerId?: string | null;
  selectedProjectId?: string | null;
  initialGalleryMode?: string;
  stripeReady?: boolean;
  guestUploadUrl?: string | null;
};

function dateInputValue(date: Date | null | undefined) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

const fieldClass =
  "h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-brass">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-graphite/70">{description}</p>
    </div>
  );
}

export function GalleryForm({
  gallery,
  customers = [],
  projects = [],
  selectedCustomerId = null,
  selectedProjectId = null,
  initialGalleryMode = GALLERY_MODE_FULL,
  stripeReady = false,
  guestUploadUrl = null
}: GalleryFormProps) {
  const action = gallery
    ? updateGalleryAction.bind(null, gallery.id)
    : createGalleryAction;
  const defaultCustomerId = gallery?.customerId ?? selectedCustomerId ?? "";
  const defaultProjectId = gallery?.projectId ?? selectedProjectId ?? "";
  const selectedCustomer = customers.find((customer) => customer.id === defaultCustomerId) ?? null;
  const selectedProject = projects.find((project) => project.id === defaultProjectId) ?? null;
  const defaultEventDate = gallery?.eventDate ?? selectedProject?.eventDate ?? selectedCustomer?.weddingDate ?? null;
  const defaultGalleryMode = gallery?.galleryMode ?? initialGalleryMode;
  const defaultDeliveryMode = normalizeGalleryDeliveryMode(
    gallery?.deliveryMode ?? (gallery?.downloadsEnabled === false ? GALLERY_DELIVERY_VIEW_ONLY : GALLERY_DELIVERY_FREE_DOWNLOAD)
  );
  const defaultSaleCurrency = normalizeSaleCurrency(gallery?.saleCurrency);
  const defaultMobileColumnCount = Math.min(3, Math.max(1, gallery?.publicColumnCount ?? 1));
  const pricingTierRows = [
    ...normalizeGallerySalePricingTiers(gallery?.salePricingTiers),
    ...Array.from({ length: 3 }, () => ({ from: null, to: null, unitPriceCents: null }))
  ].slice(0, 4);
  const proofingMode = defaultGalleryMode === GALLERY_MODE_PROOFING;
  const paidModeAvailable = stripeReady || defaultDeliveryMode === GALLERY_DELIVERY_PAID;

  return (
    <form action={action} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-7">
      <input type="hidden" name="publicColumnCount" value={defaultMobileColumnCount} />
      <div className="flex flex-col justify-between gap-3 border-b border-ink/10 pb-5 md:flex-row md:items-start">
        <div>
          <h2 className="text-xl font-semibold text-ink">{proofingMode ? "Nyers válogatás adatai" : "Kész galéria adatai"}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
            {proofingMode
              ? "Az ügyfél nyers képekből választ, a kész galéria később ebből az útvonalból születik meg."
              : "Végleges képek átadásához, vendéggalériához és letöltésekhez használd ezt az útvonalat."}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-7">
        <GalleryPublishSettings
          defaultIsActive={Boolean(gallery?.isActive)}
          defaultDeliveryMode={defaultDeliveryMode}
          stripeReady={stripeReady}
          paidModeAvailable={paidModeAvailable}
          salePriceCents={gallery?.salePriceCents ?? 0}
          saleUnitPriceCents={gallery?.saleUnitPriceCents ?? 0}
          salePricingTiers={pricingTierRows}
          saleCurrency={defaultSaleCurrency}
        />

        <section className="space-y-5 rounded-md border border-ink/10 bg-white p-4">
          <SectionTitle
            title="Név és publikus link"
            description="A vendégoldalon megjelenő név és a megosztható galéria útvonala."
          />
          <SlugFields defaultTitle={gallery?.title} defaultSlug={gallery?.slug} />
        </section>

        <div className="grid gap-7 lg:grid-cols-2 lg:items-start">
          <section className="space-y-5">
            <SectionTitle
              title="Alapadatok"
              description="Ügyfél, projekt típusa és a borítón megjelenő dátum."
            />

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <UserRound size={15} />
                Ügyfél
              </span>
              <select
                name="customerId"
                defaultValue={defaultCustomerId}
                className={fieldClass}
              >
                <option value="">Nincs ügyfélhez rendelve</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.coupleName} · {customerTypeLabel(customer.customerType)} · {customer.primaryEmail}
                  </option>
                ))}
              </select>
              <span className="block text-xs leading-5 text-graphite/70">
                Ügyfélhez kapcsolt munkáknál innen jön az értesítési email és az ügyfélfolyamat. Saját galériához hagyd üresen.
              </span>
              {selectedCustomer ? (
                <span className="block rounded-md bg-paper px-3 py-2 text-xs leading-5 text-graphite">
                  Értesítési email: <span className="font-medium text-ink">{selectedCustomer.primaryEmail}</span>
                </span>
              ) : gallery?.clientEmail ? (
                <span className="block rounded-md bg-paper px-3 py-2 text-xs leading-5 text-graphite">
                  Régi galéria email: <span className="font-medium text-ink">{gallery.clientEmail}</span>
                </span>
              ) : null}
            </label>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <Images size={15} />
                Projekt / fotózás
              </span>
              <select
                name="projectId"
                defaultValue={defaultProjectId}
                className={fieldClass}
              >
                <option value="">Nincs külön projekthez rendelve</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.customer.coupleName} · {project.title} · {customerProjectTypeLabel(project.projectType)}
                  </option>
                ))}
              </select>
              <span className="block text-xs leading-5 text-graphite/70">
                Több fotózásnál itt válaszd ki, melyik munkacsomag alá kerüljön a galéria.
              </span>
              {selectedProject ? (
                <span className="block rounded-md bg-paper px-3 py-2 text-xs leading-5 text-graphite">
                  Projekt: <span className="font-medium text-ink">{selectedProject.title}</span>
                  {selectedProject.venue ? ` · ${selectedProject.venue}` : ""}
                </span>
              ) : null}
            </label>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <Images size={15} />
                Galéria workflow
              </span>
              <select
                name="galleryMode"
                defaultValue={defaultGalleryMode}
                className={fieldClass}
              >
                <option value={GALLERY_MODE_FULL}>Kész galéria átadásra</option>
                <option value={GALLERY_MODE_PROOFING}>Nyers képek válogatásra</option>
              </select>
              <span className="block text-xs leading-5 text-graphite/70">
                Ezt később is módosíthatod, de a feltöltés és az ügyfél útvonala ehhez igazodik.
              </span>
            </label>

            <label className="block max-w-xs space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <CalendarDays size={15} />
                Esemény dátuma
              </span>
              <input
                name="eventDate"
                type="date"
                defaultValue={dateInputValue(defaultEventDate)}
                className={fieldClass}
              />
              <span className="block text-xs leading-5 text-graphite/70">
                Ez jelenik meg a publikus galéria borító szövegében.
              </span>
            </label>
          </section>

          <section className="space-y-5">
            <SectionTitle
              title="Publikus elérés"
              description="PIN-kód a vendégek felé."
            />

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <LockKeyhole size={15} />
                Galéria PIN-kód
              </span>
              <input
                name="password"
                type="text"
                defaultValue={gallery?.password ?? ""}
                inputMode="numeric"
                autoComplete="off"
                placeholder="pl. 2486"
                className={fieldClass}
              />
              <span className="block text-xs leading-5 text-graphite/70">
                Üresen hagyva a publikus galéria PIN nélkül nyitható. Ha kitöltöd, a vendég csak ezzel a kóddal látja a galériát.
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-md border border-ink/10 bg-paper p-4">
              <input
                type="checkbox"
                name="guestUploadsEnabled"
                defaultChecked={Boolean(gallery?.guestUploadsEnabled)}
                className="mt-1 size-4 accent-ink"
              />
              <span>
                <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <UploadCloud size={15} />
                  Vendégfotó feltöltés
                </span>
                <span className="mt-1 block text-xs leading-5 text-graphite/70">
                  Ha aktív, a publikus galériában megjelenik egy külön feltöltési blokk. A vendégfotók nem keverednek a fotós képei közé és nem kerülnek bele a ZIP csomagba.
                </span>
              </span>
            </label>
            {gallery?.guestUploadsEnabled && guestUploadUrl ? (
              <div className="rounded-md border border-brass/20 bg-brass/[0.06] p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <UploadCloud size={15} />
                  Vendégfeltöltési gyors link
                </p>
                <p className="mt-1 text-xs leading-5 text-graphite/70">
                  Ezt küldd el a vendégeknek. A link közvetlenül a feltöltési blokkhoz visz.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <CopyLinkButton url={guestUploadUrl} label="Feltöltési link másolása" className="w-full sm:w-auto" />
                  <a
                    href={guestUploadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-4 text-sm font-medium text-ink transition hover:border-ink/25 hover:bg-paper sm:w-auto"
                  >
                    <ExternalLink size={16} />
                    Megnyitás
                  </a>
                </div>
                <p className="mt-3 break-all rounded-md bg-white px-3 py-2 text-xs text-graphite/70">{guestUploadUrl}</p>
              </div>
            ) : gallery ? (
              <div className="rounded-md border border-ink/10 bg-white p-4 text-xs leading-5 text-graphite/70">
                A gyors link mentés után jelenik meg, ha a vendégfotó feltöltést engedélyezed.
              </div>
            ) : null}

          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center">
          <FormSubmitButton>{gallery ? "Módosítások mentése" : "Galéria létrehozása"}</FormSubmitButton>
          <p className="text-sm text-graphite/70">A módosítások azonnal érvényesek a publikus galérián.</p>
        </div>
      </div>
    </form>
  );
}
