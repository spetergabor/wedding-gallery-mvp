import { CalendarDays, Check, Columns3, CreditCard, Download, Eye, Images, LockKeyhole, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { createGalleryAction, updateGalleryAction } from "@/lib/gallery-actions";
import { Button } from "@/components/button";
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
import { formatGallerySalePrice, normalizeSaleCurrency } from "@/lib/gallery-sales";

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
    saleCurrency: string;
    downloadsEnabled: boolean;
    publicColumnCount: number;
    clientEmail: string | null;
  };
  customers?: CustomerOption[];
  projects?: ProjectOption[];
  selectedCustomerId?: string | null;
  selectedProjectId?: string | null;
  initialGalleryMode?: string;
  stripeReady?: boolean;
};

function dateInputValue(date: Date | null | undefined) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function salePriceInputValue(cents: number | null | undefined) {
  if (!cents) {
    return "";
  }

  return (cents / 100).toFixed(2).replace(".", ",");
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

function ToggleField({
  name,
  defaultChecked,
  icon,
  title,
  description
}: {
  name: string;
  defaultChecked?: boolean;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label className="flex min-h-24 cursor-pointer items-start gap-3 rounded-md border border-ink/10 bg-paper px-4 py-4 transition hover:border-ink/20">
      <span className="relative mt-1 flex size-5 shrink-0 items-center justify-center rounded border border-ink/20 bg-white">
        <input
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          className="peer absolute inset-0 cursor-pointer opacity-0"
        />
        <Check className="hidden text-ink peer-checked:block" size={14} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          {icon}
          {title}
        </span>
        <span className="mt-1 block text-sm leading-6 text-graphite/70">{description}</span>
      </span>
    </label>
  );
}

export function GalleryForm({
  gallery,
  customers = [],
  projects = [],
  selectedCustomerId = null,
  selectedProjectId = null,
  initialGalleryMode = GALLERY_MODE_FULL,
  stripeReady = false
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
  const proofingMode = defaultGalleryMode === GALLERY_MODE_PROOFING;
  const paidModeAvailable = stripeReady || defaultDeliveryMode === GALLERY_DELIVERY_PAID;

  return (
    <form action={action} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-7">
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
        <SlugFields defaultTitle={gallery?.title} defaultSlug={gallery?.slug} />

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
                Galéria típusa
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
              description="PIN-kód, láthatóság és letöltési jogosultság a vendégek felé."
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

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <ToggleField
                name="isActive"
                defaultChecked={gallery?.isActive}
                icon={<Eye size={15} />}
                title="Aktív galéria"
                description="Csak aktív galéria érhető el a publikus linken."
              />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-graphite">Átadás módja</legend>
              <div className="grid gap-3">
                {[
                  {
                    value: GALLERY_DELIVERY_VIEW_ONLY,
                    icon: <Eye size={15} />,
                    title: "Csak megtekintés",
                    description: "A vendég láthatja a galériát, de nincs letöltés és nincs vásárlás."
                  },
                  {
                    value: GALLERY_DELIVERY_FREE_DOWNLOAD,
                    icon: <Download size={15} />,
                    title: "Ingyenesen letölthető",
                    description: "A vendég ZIP-et és egyes képeket is kérhet letöltésre."
                  },
                  {
                    value: GALLERY_DELIVERY_PAID,
                    icon: <CreditCard size={15} />,
                    title: "Megvásárolható galéria",
                    description: stripeReady
                      ? "A vendég preview képeket lát, a teljes felbontás fizetés után lesz elérhető."
                      : "Előbb kösd össze a saját Stripe fiókodat a Beállítások > Integrációk alatt."
                  }
                ].map((option) => {
                  const disabled = option.value === GALLERY_DELIVERY_PAID && !paidModeAvailable;

                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-4 transition ${
                        disabled
                          ? "cursor-not-allowed border-ink/10 bg-ink/[0.03] opacity-60"
                          : "border-ink/10 bg-paper hover:border-ink/25"
                      }`}
                    >
                      <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-ink/20 bg-white">
                        <input
                          name="deliveryMode"
                          type="radio"
                          value={option.value}
                          defaultChecked={defaultDeliveryMode === option.value}
                          disabled={disabled}
                          className="peer absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                        />
                        <span className="hidden size-2.5 rounded-full bg-ink peer-checked:block" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                          {option.icon}
                          {option.title}
                        </span>
                        <span className="mt-1 block text-sm leading-6 text-graphite/70">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {!stripeReady ? (
                <a href="/admin/settings?tab=integrations" className="inline-flex text-sm font-medium text-brass hover:text-ink">
                  Stripe összekötése a fizetős galériákhoz
                </a>
              ) : null}
              <div className="rounded-md border border-ink/10 bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">Fizetős galéria ára</p>
                    <p className="mt-1 text-sm leading-6 text-graphite/70">
                      Csak a megvásárolható galéria módnál használjuk. Sikeres fizetés után a vendég e-mailben kapja meg a letöltő linket.
                    </p>
                    <p className="mt-2 text-xs leading-5 text-graphite/60">
                      0,00 árral Stripe teszt Checkout indul kártyaadat nélkül. Ha a teszt bankkártyás mezőt is látni akarod, adj meg kis
                      összeget, például 0,50 EUR-t Stripe test módban.
                    </p>
                  </div>
                  {gallery?.salePriceCents ? (
                    <span className="w-fit rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass">
                      {formatGallerySalePrice(gallery.salePriceCents, gallery.saleCurrency)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px]">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-graphite">Ár</span>
                    <input
                      name="salePrice"
                      inputMode="decimal"
                      defaultValue={salePriceInputValue(gallery?.salePriceCents)}
                      placeholder="pl. 49,00"
                      className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-graphite">Deviza</span>
                    <select
                      name="saleCurrency"
                      defaultValue={defaultSaleCurrency}
                      className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
                    >
                      <option value="eur">EUR</option>
                      <option value="usd">USD</option>
                      <option value="gbp">GBP</option>
                      <option value="chf">CHF</option>
                    </select>
                  </label>
                </div>
              </div>
            </fieldset>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <Columns3 size={15} />
                Mobil fotórács
              </span>
              <select name="publicColumnCount" defaultValue={defaultMobileColumnCount} className={fieldClass}>
                <option value="1">1 oszlopos nézet</option>
                <option value="2">2 oszlopos nézet</option>
                <option value="3">3 oszlopos nézet</option>
              </select>
              <span className="block text-xs leading-5 text-graphite/70">
                Csak telefonos nézetben hat. Az asztali galéria marad a megszokott automatikus oszlopos elrendezésben.
              </span>
            </label>
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
