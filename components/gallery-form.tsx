import { CalendarDays, Check, Columns3, Download, Eye, Images, LockKeyhole, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { createGalleryAction, updateGalleryAction } from "@/lib/gallery-actions";
import { Button } from "@/components/button";
import { customerProjectTypeLabel } from "@/lib/customer-project-options";
import { customerTypeLabel } from "@/lib/customer-options";
import { SlugFields } from "@/components/slug-fields";
import { GALLERY_MODE_FULL, GALLERY_MODE_PROOFING } from "@/lib/proofing";
import { FormSubmitButton } from "@/components/form-submit-button";

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
    downloadsEnabled: boolean;
    publicColumnCount: number;
    clientEmail: string | null;
  };
  customers?: CustomerOption[];
  projects?: ProjectOption[];
  selectedCustomerId?: string | null;
  selectedProjectId?: string | null;
  initialGalleryMode?: string;
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

export function GalleryForm({
  gallery,
  customers = [],
  projects = [],
  selectedCustomerId = null,
  selectedProjectId = null,
  initialGalleryMode = GALLERY_MODE_FULL
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
  const defaultPublicColumnCount = Math.min(3, Math.max(1, gallery?.publicColumnCount ?? 3));
  const proofingMode = defaultGalleryMode === GALLERY_MODE_PROOFING;

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

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <Columns3 size={15} />
                Vendégoldali fotórács
              </span>
              <select name="publicColumnCount" defaultValue={defaultPublicColumnCount} className={fieldClass}>
                <option value="1">1 oszlopos nézet</option>
                <option value="2">2 oszlopos nézet</option>
                <option value="3">3 oszlopos nézet</option>
              </select>
              <span className="block text-xs leading-5 text-graphite/70">
                A publikus vendéggaléria maximum ennyi oszlopban jeleníti meg a fotókat. Mobilon továbbra is egy oszlopos marad.
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
