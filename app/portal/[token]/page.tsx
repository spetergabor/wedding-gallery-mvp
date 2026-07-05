import { Building2, CalendarDays, CheckCircle2, ExternalLink, FileText, Heart, ImagePlus, Mail, MapPin, Phone, Trash2, UploadCloud, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { Alert } from "@/components/alert";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { CustomerPortalDetailsForm } from "@/components/customer-portal-details-form";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  createCustomerVendorAction,
  deleteCustomerPortalImageAction,
  deleteCustomerVendorAction,
  uploadCustomerPortalImageAction
} from "@/lib/customer-portal-actions";
import { normalizeCustomerLanguage } from "@/lib/customer-language";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { contractPublicUrl } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

const fieldClass =
  "h-12 w-full min-w-0 rounded-md border border-ink/15 bg-white px-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";
const textAreaClass =
  "min-h-28 w-full min-w-0 rounded-md border border-ink/15 bg-white px-3 py-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";
const fileInputClass =
  "block w-full min-w-0 rounded-md border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink outline-none transition file:mr-4 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-graphite focus:border-ink/50";

const PORTAL_COPY = {
  hu: {
    eyebrow: "Esküvői ügyfélportál",
    intro: "Itt tudjátok frissíteni az esküvői adatokat, feltölteni inspirációkat és összegyűjteni a fontos szolgáltatókat.",
    saved: "Adatok mentve.",
    vendorCreated: "Szolgáltató hozzáadva.",
    vendorDeleted: "Szolgáltató törölve.",
    imageUploaded: "Inspirációs kép feltöltve.",
    imageDeleted: "Kép törölve.",
    missing: "Kérlek töltsétek ki a kötelező mezőket.",
    imageMissing: "Válasszatok ki egy képet.",
    imageType: "Csak képfájl tölthető fel.",
    imageSize: "Maximum 12 MB-os képet töltsetek fel.",
    coupleData: "Pár és esküvői adatok",
    coupleDataIntro: "Ezeket az adatokat a fotós is látja az admin felületen.",
    wifeName: "Feleség neve",
    wifeEmail: "Feleség e-mail címe",
    wifePhone: "Feleség telefonszáma",
    husbandName: "Férj neve",
    husbandEmail: "Férj e-mail címe",
    husbandPhone: "Férj telefonszáma",
    weddingDate: "Esküvő dátuma",
    locations: "Helyszínek",
    mainLocation: "Fő helyszín",
    weddingAddress: "Fő helyszín címe",
    gettingReady: "Készülődés helyszíne",
    churchCeremony: "Templomi szertartás helyszíne",
    civilCeremony: "Polgári szertartás helyszíne",
    schedule: "Menetrend",
    styleNotes: "Styling, hangulat, inspiráció",
    importantPeople: "Fontos emberek / családi infók",
    notes: "Egyéb megjegyzés",
    email: "E-mail",
    phone: "Telefon",
    edit: "Szerkesztés",
    editing: "Szerkesztés alatt",
    editingHint: "Most módosíthatók a mezők. Mentés után az adatlap újra lezárt nézetbe kerül.",
    cancel: "Mégse",
    locked: "Lezárt adatlap",
    lockedHint: "Az adatok alapból csak olvashatók. Szerkesztéshez nyomjátok meg a Szerkesztés gombot.",
    save: "Adatok mentése",
    saving: "Mentés...",
    inspiration: "Inspirációs képek",
    inspirationIntro: "Töltsetek fel hangulatképeket, stylingot, helyszínfotókat vagy Pinterest-jellegű inspirációt.",
    imageTitle: "Kép címe",
    imageNotes: "Megjegyzés a képhez",
    uploadImage: "Kép feltöltése",
    vendors: "Szolgáltatók",
    vendorsIntro: "Dekor, videós, DJ, smink, ceremóniamester és minden kontakt, ami hasznos lehet.",
    role: "Szerep",
    vendorName: "Szolgáltató neve",
    contactName: "Kapcsolattartó",
    website: "Weboldal / Instagram",
    vendorNotes: "Megjegyzés",
    addVendor: "Szolgáltató hozzáadása",
    contracts: "Szerződések",
    noContracts: "Még nincs megnyitható szerződés.",
    openContract: "Megnyitás",
    signed: "Aláírva",
    sent: "Elküldve",
    photographer: "Fotós adatai",
    noImages: "Még nincs feltöltött inspiráció.",
    noVendors: "Még nincs szolgáltató megadva.",
    delete: "Törlés"
  },
  de: {
    eyebrow: "Hochzeits-Kundenportal",
    intro: "Hier könnt ihr eure Hochzeitsdaten aktualisieren, Inspirationen hochladen und wichtige Dienstleister sammeln.",
    saved: "Daten gespeichert.",
    vendorCreated: "Dienstleister hinzugefügt.",
    vendorDeleted: "Dienstleister gelöscht.",
    imageUploaded: "Inspirationsbild hochgeladen.",
    imageDeleted: "Bild gelöscht.",
    missing: "Bitte füllt die Pflichtfelder aus.",
    imageMissing: "Bitte wählt ein Bild aus.",
    imageType: "Es können nur Bilddateien hochgeladen werden.",
    imageSize: "Bitte ladet Bilder bis maximal 12 MB hoch.",
    coupleData: "Paar- und Hochzeitsdaten",
    coupleDataIntro: "Diese Angaben sieht auch euer Fotograf im Adminbereich.",
    wifeName: "Name der Braut",
    wifeEmail: "E-Mail der Braut",
    wifePhone: "Telefon der Braut",
    husbandName: "Name des Bräutigams",
    husbandEmail: "E-Mail des Bräutigams",
    husbandPhone: "Telefon des Bräutigams",
    weddingDate: "Hochzeitsdatum",
    locations: "Locations",
    mainLocation: "Hauptlocation",
    weddingAddress: "Adresse der Hauptlocation",
    gettingReady: "Getting-ready Location",
    churchCeremony: "Kirchliche Trauung",
    civilCeremony: "Standesamtliche Trauung",
    schedule: "Tagesablauf",
    styleNotes: "Styling, Stimmung, Inspiration",
    importantPeople: "Wichtige Personen / Familieninfos",
    notes: "Weitere Notizen",
    email: "E-Mail",
    phone: "Telefon",
    edit: "Bearbeiten",
    editing: "Bearbeitung aktiv",
    editingHint: "Die Felder können jetzt geändert werden. Nach dem Speichern ist das Formular wieder gesperrt.",
    cancel: "Abbrechen",
    locked: "Gesperrtes Formular",
    lockedHint: "Die Angaben sind standardmäßig nur lesbar. Zum Ändern bitte auf Bearbeiten klicken.",
    save: "Daten speichern",
    saving: "Speichern...",
    inspiration: "Inspirationsbilder",
    inspirationIntro: "Ladet Moodboards, Styling, Locationfotos oder Pinterest-Inspirationen hoch.",
    imageTitle: "Bildtitel",
    imageNotes: "Notiz zum Bild",
    uploadImage: "Bild hochladen",
    vendors: "Dienstleister",
    vendorsIntro: "Dekoration, Video, DJ, Make-up, Trauung und alle Kontakte, die wichtig sein könnten.",
    role: "Rolle",
    vendorName: "Name des Dienstleisters",
    contactName: "Kontaktperson",
    website: "Website / Instagram",
    vendorNotes: "Notiz",
    addVendor: "Dienstleister hinzufügen",
    contracts: "Verträge",
    noContracts: "Noch kein Vertrag verfügbar.",
    openContract: "Öffnen",
    signed: "Unterschrieben",
    sent: "Gesendet",
    photographer: "Fotograf Kontakt",
    noImages: "Noch keine Inspiration hochgeladen.",
    noVendors: "Noch kein Dienstleister eingetragen.",
    delete: "Löschen"
  }
} as const;

function formatDate(date: Date | null, language: "hu" | "de") {
  if (!date) {
    return language === "hu" ? "Nincs dátum megadva" : "Kein Datum angegeben";
  }

  return date.toLocaleDateString(language === "hu" ? "hu-HU" : "de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

function value(value: string | null | undefined, language: "hu" | "de") {
  return value?.trim() || (language === "hu" ? "Nincs megadva" : "Nicht angegeben");
}

export default async function CustomerPortalPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    updated?: string;
    vendorCreated?: string;
    vendorDeleted?: string;
    vendorError?: string;
    imageUploaded?: string;
    imageDeleted?: string;
    imageError?: string;
    error?: string;
  }>;
}) {
  const [{ token }, flags] = await Promise.all([params, searchParams]);
  const customer = await prisma.customer.findUnique({
    where: { portalToken: token },
    include: {
      admin: {
        select: {
          name: true,
          email: true,
          phone: true,
          siteSettings: {
            select: {
              businessName: true,
              websiteUrl: true,
              instagramUrl: true,
              facebookUrl: true,
              contactEmail: true,
              contactPhone: true
            }
          }
        }
      },
      portalImages: {
        orderBy: { createdAt: "desc" }
      },
      vendors: {
        orderBy: [{ role: "asc" }, { name: "asc" }]
      },
      contracts: {
        where: {
          OR: [
            { sentAt: { not: null } },
            { signedAt: { not: null } },
            { accessToken: { not: null } },
            { signedFileUrl: { not: null } }
          ]
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!customer || customer.customerType !== "wedding_couple") {
    notFound();
  }

  const language = normalizeCustomerLanguage(customer.preferredLanguage);
  const copy = PORTAL_COPY[language];
  const photographerName = customer.admin.siteSettings?.businessName || customer.admin.name;
  const photographerEmail = customer.admin.siteSettings?.contactEmail || customer.admin.email;
  const photographerPhone = customer.admin.siteSettings?.contactPhone || customer.admin.phone;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <section className="border-b border-ink/10 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">{copy.eyebrow}</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-normal text-ink md:text-5xl">{customer.coupleName}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-graphite/75">{copy.intro}</p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-graphite/75">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper px-3 py-2">
                <CalendarDays size={16} />
                {formatDate(customer.weddingDate, language)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper px-3 py-2">
                <MapPin size={16} />
                {value(customer.mainLocation || customer.venue || customer.weddingLocation, language)}
              </span>
            </div>
          </div>

          <aside className="rounded-md border border-ink/10 bg-paper p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Heart size={18} />
              {copy.photographer}
            </h2>
            <div className="mt-4 space-y-3 text-sm text-graphite/75">
              <p className="font-medium text-ink">{photographerName}</p>
              {photographerEmail ? (
                <a href={`mailto:${photographerEmail}`} className="flex items-center gap-2 hover:text-ink">
                  <Mail size={15} />
                  {photographerEmail}
                </a>
              ) : null}
              {photographerPhone ? (
                <a href={`tel:${photographerPhone}`} className="flex items-center gap-2 hover:text-ink">
                  <Phone size={15} />
                  {photographerPhone}
                </a>
              ) : null}
              {customer.admin.siteSettings?.websiteUrl ? (
                <a href={customer.admin.siteSettings.websiteUrl} target="_blank" className="flex items-center gap-2 hover:text-ink">
                  <ExternalLink size={15} />
                  Website
                </a>
              ) : null}
            </div>
          </aside>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-8 lg:px-10">
        <div className="mb-5 space-y-3">
          {flags.updated ? <Alert title={copy.saved} variant="success" /> : null}
          {flags.vendorCreated ? <Alert title={copy.vendorCreated} variant="success" /> : null}
          {flags.vendorDeleted ? <Alert title={copy.vendorDeleted} variant="success" /> : null}
          {flags.imageUploaded ? <Alert title={copy.imageUploaded} variant="success" /> : null}
          {flags.imageDeleted ? <Alert title={copy.imageDeleted} variant="success" /> : null}
          {flags.error === "missing" || flags.vendorError === "missing" ? <Alert title={copy.missing} variant="error" /> : null}
          {flags.imageError === "missing" ? <Alert title={copy.imageMissing} variant="error" /> : null}
          {flags.imageError === "type" ? <Alert title={copy.imageType} variant="error" /> : null}
          {flags.imageError === "size" ? <Alert title={copy.imageSize} variant="error" /> : null}
        </div>

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-7">
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-7">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <UserRound size={20} />
                {copy.coupleData}
              </h2>
              <p className="mt-2 text-sm leading-6 text-graphite/70">{copy.coupleDataIntro}</p>

              <CustomerPortalDetailsForm
                token={token}
                copy={copy}
                customer={{
                  wifeName: customer.wifeName,
                  wifeEmail: customer.wifeEmail,
                  wifePhone: customer.wifePhone,
                  husbandName: customer.husbandName,
                  husbandEmail: customer.husbandEmail,
                  husbandPhone: customer.husbandPhone,
                  partnerName: customer.partnerName,
                  partnerEmail: customer.partnerEmail,
                  partnerPhone: customer.partnerPhone,
                  primaryEmail: customer.primaryEmail,
                  secondaryEmail: customer.secondaryEmail,
                  phone: customer.phone,
                  weddingDateValue: customer.weddingDate ? customer.weddingDate.toISOString().slice(0, 10) : "",
                  venue: customer.venue,
                  weddingLocation: customer.weddingLocation,
                  weddingAddress: customer.weddingAddress,
                  gettingReadyLocation: customer.gettingReadyLocation,
                  churchCeremonyLocation: customer.churchCeremonyLocation,
                  civilCeremonyLocation: customer.civilCeremonyLocation,
                  mainLocation: customer.mainLocation,
                  ceremonyLocation: customer.ceremonyLocation,
                  weddingSchedule: customer.weddingSchedule,
                  weddingStyleNotes: customer.weddingStyleNotes,
                  importantPeopleNotes: customer.importantPeopleNotes,
                  portalNotes: customer.portalNotes
                }}
              />
            </section>

            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-7">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <ImagePlus size={20} />
                {copy.inspiration}
              </h2>
              <p className="mt-2 text-sm leading-6 text-graphite/70">{copy.inspirationIntro}</p>

              <form action={uploadCustomerPortalImageAction.bind(null, token)} className="mt-5 grid gap-4 rounded-md bg-paper p-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-graphite">{copy.uploadImage}</span>
                  <input name="image" type="file" accept="image/*" required className={fileInputClass} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-graphite">{copy.imageTitle}</span>
                  <input name="title" className={fieldClass} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-graphite">{copy.imageNotes}</span>
                  <input name="notes" className={fieldClass} />
                </label>
                <div className="md:col-span-2">
                  <FormSubmitButton pendingLabel={copy.saving}>
                    <UploadCloud size={16} />
                    {copy.uploadImage}
                  </FormSubmitButton>
                </div>
              </form>

              {customer.portalImages.length === 0 ? (
                <p className="mt-5 rounded-md bg-paper px-4 py-3 text-sm text-graphite/70">{copy.noImages}</p>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {customer.portalImages.map((image) => (
                    <article key={image.id} className="overflow-hidden rounded-md border border-ink/10 bg-paper">
                      <a href={image.imageUrl} target="_blank">
                        <img src={image.imageUrl} alt={image.title || image.originalFilename} className="aspect-[4/3] w-full object-cover" />
                      </a>
                      <div className="p-3">
                        <p className="font-medium text-ink">{image.title || image.originalFilename}</p>
                        {image.notes ? <p className="mt-1 text-sm leading-5 text-graphite/70">{image.notes}</p> : null}
                        <form action={deleteCustomerPortalImageAction.bind(null, token, image.id)} className="mt-3">
                          <ConfirmSubmitButton variant="ghost" className="h-9 px-2 text-xs" message={copy.delete}>
                            <Trash2 size={14} />
                            {copy.delete}
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-7">
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <Building2 size={20} />
                {copy.vendors}
              </h2>
              <p className="mt-2 text-sm leading-6 text-graphite/70">{copy.vendorsIntro}</p>

              <form action={createCustomerVendorAction.bind(null, token)} className="mt-5 space-y-4 rounded-md bg-paper p-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">{copy.role}</span>
                  <input name="role" required placeholder="DJ, Video, Dekor..." className={fieldClass} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">{copy.vendorName}</span>
                  <input name="name" required className={fieldClass} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">{copy.contactName}</span>
                  <input name="contactName" className={fieldClass} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">{copy.email}</span>
                  <input name="email" type="email" className={fieldClass} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">{copy.phone}</span>
                  <input name="phone" className={fieldClass} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">{copy.website}</span>
                  <input name="website" className={fieldClass} />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-graphite">{copy.vendorNotes}</span>
                  <textarea name="notes" className={textAreaClass} />
                </label>
                <FormSubmitButton pendingLabel={copy.saving}>{copy.addVendor}</FormSubmitButton>
              </form>

              {customer.vendors.length === 0 ? (
                <p className="mt-5 rounded-md bg-paper px-4 py-3 text-sm text-graphite/70">{copy.noVendors}</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {customer.vendors.map((vendor) => (
                    <article key={vendor.id} className="rounded-md border border-ink/10 bg-paper p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/55">{vendor.role}</p>
                      <h3 className="mt-1 font-semibold text-ink">{vendor.name}</h3>
                      <div className="mt-2 space-y-1 text-sm text-graphite/70">
                        {vendor.contactName ? <p>{vendor.contactName}</p> : null}
                        {vendor.email ? <p>{vendor.email}</p> : null}
                        {vendor.phone ? <p>{vendor.phone}</p> : null}
                        {vendor.website ? (
                          <a href={vendor.website} target="_blank" className="inline-flex items-center gap-1.5 font-medium text-ink">
                            <ExternalLink size={14} />
                            {vendor.website}
                          </a>
                        ) : null}
                        {vendor.notes ? <p className="leading-5">{vendor.notes}</p> : null}
                      </div>
                      <form action={deleteCustomerVendorAction.bind(null, token, vendor.id)} className="mt-3">
                        <ConfirmSubmitButton variant="ghost" className="h-9 px-2 text-xs" message={copy.delete}>
                          <Trash2 size={14} />
                          {copy.delete}
                        </ConfirmSubmitButton>
                      </form>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
                <FileText size={20} />
                {copy.contracts}
              </h2>
              {customer.contracts.length === 0 ? (
                <p className="mt-4 rounded-md bg-paper px-4 py-3 text-sm text-graphite/70">{copy.noContracts}</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {customer.contracts.map((contract) => {
                    const href = contract.signedFileUrl || (contract.accessToken ? contractPublicUrl(contract.accessToken) : contract.fileUrl);
                    const isSigned = Boolean(contract.signedAt || contract.signedFileUrl);

                    return (
                      <article key={contract.id} className="rounded-md border border-ink/10 bg-paper p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-ink">{contract.title}</h3>
                            <p className="mt-1 text-sm text-graphite/70">{isSigned ? copy.signed : copy.sent}</p>
                          </div>
                          {isSigned ? <CheckCircle2 className="text-sage" size={18} /> : null}
                        </div>
                        {href ? (
                          <a href={href} target="_blank" className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-white px-3 text-sm font-medium text-ink transition hover:bg-ink/5">
                            <ExternalLink size={15} />
                            {copy.openContract}
                          </a>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
