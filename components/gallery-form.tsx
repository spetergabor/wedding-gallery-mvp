import { CalendarDays, Check, Download, Eye, Images, LockKeyhole, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { createGalleryAction, updateGalleryAction } from "@/lib/gallery-actions";
import { Button } from "@/components/button";
import { customerTypeLabel } from "@/components/customer-form";
import { SlugFields } from "@/components/slug-fields";
import { GALLERY_MODE_FULL, GALLERY_MODE_PROOFING } from "@/lib/proofing";

type CustomerOption = {
  id: string;
  customerType: string;
  coupleName: string;
  primaryEmail: string;
  weddingDate: Date | null;
};

type GalleryFormProps = {
  gallery?: {
    id: string;
    customerId: string | null;
    title: string;
    slug: string;
    password: string | null;
    eventDate: Date | null;
    isActive: boolean;
    galleryMode: string;
    downloadsEnabled: boolean;
    clientEmail: string | null;
  };
  customers?: CustomerOption[];
  selectedCustomerId?: string | null;
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

export function GalleryForm({ gallery, customers = [], selectedCustomerId = null }: GalleryFormProps) {
  const action = gallery
    ? updateGalleryAction.bind(null, gallery.id)
    : createGalleryAction;
  const defaultCustomerId = gallery?.customerId ?? selectedCustomerId ?? customers[0]?.id ?? "";
  const selectedCustomer = customers.find((customer) => customer.id === defaultCustomerId) ?? null;
  const defaultEventDate = gallery?.eventDate ?? selectedCustomer?.weddingDate ?? null;

  return (
    <form action={action} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-7">
      <div className="flex flex-col justify-between gap-3 border-b border-ink/10 pb-5 md:flex-row md:items-start">
        <div>
          <h2 className="text-xl font-semibold text-ink">Galéria adatai</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
            A galéria egy ügyfélhez tartozik. Az ügyfél email címéből dolgozik a válogató és az átadási értesítés.
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
                required={!gallery}
                className={fieldClass}
              >
                {gallery ? <option value="">Nincs ügyfélhez rendelve</option> : null}
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.coupleName} · {customerTypeLabel(customer.customerType)} · {customer.primaryEmail}
                  </option>
                ))}
              </select>
              <span className="block text-xs leading-5 text-graphite/70">
                Új munkánál először az ügyfelet hozd létre, utána ehhez kapcsolódik a galéria, szerződés és később a fizetés.
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
                Galéria típusa
              </span>
              <select
                name="galleryMode"
                defaultValue={gallery?.galleryMode ?? GALLERY_MODE_FULL}
                className={fieldClass}
              >
                <option value={GALLERY_MODE_FULL}>Teljes galéria</option>
                <option value={GALLERY_MODE_PROOFING}>Nyers képek válogatásra</option>
              </select>
              <span className="block text-xs leading-5 text-graphite/70">
                Nyers válogatásnál külön státuszban követhető az ügyfél kiválasztása.
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
              description="Jelszó, láthatóság és letöltési jogosultság a vendégek felé."
            />

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <LockKeyhole size={15} />
                Galéria jelszó
              </span>
              <input
                name="password"
                defaultValue={gallery?.password ?? ""}
                placeholder="Opcionális"
                className={fieldClass}
              />
              <span className="block text-xs leading-5 text-graphite/70">
                Üresen hagyva a galéria a publikus linkkel közvetlenül nyitható.
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
              <ToggleField
                name="downloadsEnabled"
                defaultChecked={gallery?.downloadsEnabled ?? true}
                icon={<Download size={15} />}
                title="Letöltések"
                description="A ZIP és az egyedi képletöltés vendégoldali elérése."
              />
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center">
          <Button type="submit">{gallery ? "Módosítások mentése" : "Galéria létrehozása"}</Button>
          <p className="text-sm text-graphite/70">A módosítások azonnal érvényesek a publikus galérián.</p>
        </div>
      </div>
    </form>
  );
}
