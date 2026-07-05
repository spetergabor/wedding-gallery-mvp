import { AlertCircle, Building2, CheckCircle2, ExternalLink, FileText, Globe2, ImageIcon, PlusCircle, Users } from "lucide-react";
import { CopyLinkButton } from "@/components/copy-link-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ensureCustomerPortalAction } from "@/lib/customer-portal-actions";
import { APP_TIME_ZONE } from "@/lib/date-format";

type PortalCustomer = {
  id: string;
  customerType: string;
  coupleName: string;
  primaryEmail: string;
  secondaryEmail: string | null;
  phone: string | null;
  weddingDate: Date | null;
  venue: string | null;
  portalToken: string | null;
  wifeName: string | null;
  wifeEmail: string | null;
  wifePhone: string | null;
  husbandName: string | null;
  husbandEmail: string | null;
  husbandPhone: string | null;
  partnerName: string | null;
  partnerEmail: string | null;
  partnerPhone: string | null;
  weddingLocation: string | null;
  weddingAddress: string | null;
  gettingReadyLocation: string | null;
  churchCeremonyLocation: string | null;
  civilCeremonyLocation: string | null;
  mainLocation: string | null;
  ceremonyLocation: string | null;
  receptionLocation: string | null;
  weddingSchedule: string | null;
  weddingStyleNotes: string | null;
  importantPeopleNotes: string | null;
  portalNotes: string | null;
  portalImages: Array<{
    id: string;
    title: string | null;
    notes: string | null;
    imageUrl: string;
    originalFilename: string;
    createdAt: Date;
  }>;
  vendors: Array<{
    id: string;
    role: string;
    name: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    notes: string | null;
  }>;
  contracts: Array<{
    id: string;
    title: string;
    status: string;
    sentAt: Date | null;
    signedAt: Date | null;
    fileUrl: string;
    signedFileUrl: string | null;
    accessToken: string | null;
  }>;
};

function formatDate(date: Date | null) {
  if (!date) {
    return "Nincs megadva";
  }

  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

function value(value: string | null | undefined) {
  return value?.trim() || "Nincs megadva";
}

function statusLabel(contract: PortalCustomer["contracts"][number]) {
  if (contract.signedAt || contract.status === "signed") {
    return "Aláírva";
  }

  if (contract.sentAt || contract.accessToken) {
    return "Elküldve";
  }

  return "Vázlat";
}

function InfoItem({ label, value: itemValue }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink/10 bg-paper px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/55">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-ink">{itemValue}</p>
    </div>
  );
}

export function CustomerPortalManager({
  customer,
  portalUrl
}: {
  customer: PortalCustomer;
  portalUrl: string | null;
}) {
  const isWeddingCouple = customer.customerType === "wedding_couple";
  const visibleContracts = customer.contracts.filter(
    (contract) => contract.signedAt || contract.sentAt || contract.accessToken || contract.signedFileUrl
  );
  const completedItems = [
    Boolean(customer.portalToken),
    Boolean(customer.wifeName && customer.husbandName),
    Boolean(customer.wifeEmail && customer.husbandEmail),
    Boolean(customer.weddingDate),
    Boolean(customer.mainLocation || customer.venue || customer.weddingLocation),
    Boolean(customer.gettingReadyLocation || customer.churchCeremonyLocation || customer.civilCeremonyLocation),
    customer.vendors.length > 0,
    customer.portalImages.length > 0,
    visibleContracts.some((contract) => contract.signedAt || contract.signedFileUrl)
  ].filter(Boolean).length;

  if (!isWeddingCouple) {
    return (
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <div className="flex items-start gap-3 rounded-md bg-paper p-4">
          <AlertCircle className="mt-0.5 text-graphite/60" size={20} />
          <div>
            <h2 className="text-lg font-semibold text-ink">Ügyfélportál csak esküvős párnál</h2>
            <p className="mt-1 text-sm leading-6 text-graphite/70">
              Állítsd az ügyféltípust “Esküvős pár”-ra, és a rendszer létrehozza a párnak szóló privát portált.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 lg:flex-row lg:items-start">
        <div>
          <div className="flex size-11 items-center justify-center rounded-md bg-paper text-graphite">
            <Globe2 size={20} />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-ink">Pár ügyfélportál</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">
            Titkos linkes oldal, ahol a pár kitölti az esküvői adatokat, inspirációs képeket tölt fel,
            szolgáltatókat ad meg és eléri az aláírt szerződést.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {portalUrl ? (
            <>
              <a
                href={portalUrl}
                target="_blank"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition hover:border-ink/30"
              >
                <ExternalLink size={16} />
                Megnyitás
              </a>
              <CopyLinkButton url={portalUrl} label="Link másolása" />
            </>
          ) : (
            <form action={ensureCustomerPortalAction.bind(null, customer.id)}>
              <FormSubmitButton>
                <PlusCircle size={16} />
                Portál létrehozása
              </FormSubmitButton>
            </form>
          )}
        </div>
      </div>

      {portalUrl ? (
        <div className="mt-5 rounded-md border border-ink/10 bg-paper px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/55">Megosztható link</p>
          <p className="mt-2 break-all text-sm font-medium text-ink">{portalUrl}</p>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoItem label="Kitöltöttség" value={`${completedItems}/8 fontos pont`} />
        <InfoItem label="Pár" value={[customer.wifeName, customer.husbandName].filter(Boolean).join(" & ") || customer.coupleName} />
        <InfoItem label="Dátum" value={formatDate(customer.weddingDate)} />
        <InfoItem label="Fő helyszín" value={value(customer.mainLocation || customer.venue || customer.weddingLocation)} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-md border border-ink/10 p-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Users size={18} />
              Pár és esküvői adatok
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoItem label="Feleség neve" value={value(customer.wifeName)} />
              <InfoItem label="Férj neve" value={value(customer.husbandName || customer.partnerName)} />
              <InfoItem label="Feleség email" value={value(customer.wifeEmail || customer.primaryEmail)} />
              <InfoItem label="Férj email" value={value(customer.husbandEmail || customer.partnerEmail || customer.secondaryEmail)} />
              <InfoItem label="Feleség telefon" value={value(customer.wifePhone || customer.phone)} />
              <InfoItem label="Férj telefon" value={value(customer.husbandPhone || customer.partnerPhone)} />
              <InfoItem label="Készülődés" value={value(customer.gettingReadyLocation)} />
              <InfoItem label="Templomi szertartás" value={value(customer.churchCeremonyLocation || customer.ceremonyLocation)} />
              <InfoItem label="Polgári szertartás" value={value(customer.civilCeremonyLocation)} />
              <InfoItem label="Fő helyszín" value={value(customer.mainLocation || customer.weddingLocation || customer.venue)} />
              <InfoItem label="Fő helyszín címe" value={value(customer.weddingAddress)} />
              <InfoItem label="Fontos emberek" value={value(customer.importantPeopleNotes)} />
            </div>
            {customer.weddingSchedule || customer.weddingStyleNotes || customer.portalNotes ? (
              <div className="mt-3 grid gap-3">
                <InfoItem label="Menetrend" value={value(customer.weddingSchedule)} />
                <InfoItem label="Stílus / inspiráció" value={value(customer.weddingStyleNotes)} />
                <InfoItem label="Egyéb megjegyzés" value={value(customer.portalNotes)} />
              </div>
            ) : null}
          </section>

          <section className="rounded-md border border-ink/10 p-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <ImageIcon size={18} />
              Inspirációs képek
            </h3>
            {customer.portalImages.length === 0 ? (
              <p className="mt-3 rounded-md bg-paper px-4 py-3 text-sm text-graphite/70">Még nincs feltöltött inspiráció.</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {customer.portalImages.slice(0, 9).map((image) => (
                  <a key={image.id} href={image.imageUrl} target="_blank" className="group overflow-hidden rounded-md border border-ink/10 bg-paper">
                    <img src={image.imageUrl} alt={image.title || image.originalFilename} className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]" />
                    <div className="p-3">
                      <p className="truncate text-sm font-medium text-ink">{image.title || image.originalFilename}</p>
                      {image.notes ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-graphite/70">{image.notes}</p> : null}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-md border border-ink/10 p-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <Building2 size={18} />
              Szolgáltatók
            </h3>
            {customer.vendors.length === 0 ? (
              <p className="mt-3 rounded-md bg-paper px-4 py-3 text-sm text-graphite/70">Még nincs szolgáltató megadva.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {customer.vendors.map((vendor) => (
                  <article key={vendor.id} className="rounded-md bg-paper p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/55">{vendor.role}</p>
                    <h4 className="mt-1 font-semibold text-ink">{vendor.name}</h4>
                    <p className="mt-1 text-sm text-graphite/70">{[vendor.contactName, vendor.email, vendor.phone].filter(Boolean).join(" · ") || "Nincs kontakt adat"}</p>
                    {vendor.notes ? <p className="mt-2 text-sm leading-5 text-graphite/70">{vendor.notes}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-md border border-ink/10 p-4">
            <h3 className="flex items-center gap-2 text-base font-semibold text-ink">
              <FileText size={18} />
              Szerződések
            </h3>
            {visibleContracts.length === 0 ? (
              <p className="mt-3 rounded-md bg-paper px-4 py-3 text-sm text-graphite/70">Nincs ügyfél számára megnyitható szerződés.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {visibleContracts.map((contract) => {
                  const href = contract.signedFileUrl || contract.fileUrl;

                  return (
                    <article key={contract.id} className="rounded-md bg-paper p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-ink">{contract.title}</h4>
                          <p className="mt-1 text-sm text-graphite/70">{statusLabel(contract)}</p>
                        </div>
                        {contract.signedAt || contract.signedFileUrl ? <CheckCircle2 className="shrink-0 text-sage" size={18} /> : null}
                      </div>
                      {href ? (
                        <a href={href} target="_blank" className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-ink transition hover:bg-ink/5">
                          <ExternalLink size={15} />
                          Megnyitás
                        </a>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {portalUrl ? (
            <div className="rounded-md border border-sage/20 bg-sage/10 px-4 py-3 text-sm text-sage">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 size={16} />
                Portál aktív
              </div>
              <p className="mt-1 leading-5 text-sage/80">A link másolható és elküldhető a párnak.</p>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
