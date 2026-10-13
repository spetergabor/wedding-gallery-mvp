import { Languages, Mail, MessageSquareText, Phone, Save, Settings2 } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { updateMiniSessionConfirmationSettingsAction } from "@/lib/settings-actions";
import {
  resolveMiniSessionConfirmationContent,
  type MiniSessionConfirmationLanguageContent
} from "@/lib/mini-session-confirmation-content";

type MiniSessionConfirmationSettingsProps = {
  content: unknown;
  businessName: string;
  contactEmail: string | null;
  contactPhone: string | null;
};

type FieldDefinition = {
  key: keyof MiniSessionConfirmationLanguageContent;
  label: string;
  multiline?: boolean;
};

const FIELD_GROUPS: Array<{ title: string; description: string; fields: FieldDefinition[] }> = [
  {
    title: "Fő visszaigazolás",
    description: "A sikeres foglalás után elsőként megjelenő üzenetek.",
    fields: [
      { key: "eyebrow", label: "Felső rövid felirat" },
      { key: "title", label: "Főcím" },
      { key: "intro", label: "Bevezető szöveg", multiline: true },
      { key: "saved", label: "Sikeres mentés jelzése" }
    ]
  },
  {
    title: "Foglalási adatok feliratai",
    description: "A dinamikus foglalási adatok mellett látható állandó címkék.",
    fields: [
      { key: "appointment", label: "Foglalási blokk címe" },
      { key: "date", label: "Időpont felirata" },
      { key: "location", label: "Helyszín felirata" },
      { key: "name", label: "Név felirata" },
      { key: "attendees", label: "Létszám felirata" }
    ]
  },
  {
    title: "E-mail tájékoztató",
    description: "Az elküldött visszaigazolásról és a spam mappáról szóló rész.",
    fields: [
      { key: "emailTitle", label: "Blokk címe" },
      { key: "emailText", label: "E-mail cím előtti szöveg", multiline: true },
      { key: "spamText", label: "Spam figyelmeztetés", multiline: true }
    ]
  },
  {
    title: "Naptár és gyorsműveletek",
    description: "A naptármentési rész címei és a három gomb felirata.",
    fields: [
      { key: "saveTitle", label: "Blokk címe" },
      { key: "saveText", label: "Leírás", multiline: true },
      { key: "googleCalendar", label: "Google Naptár gomb" },
      { key: "calendarFile", label: "Apple / Outlook gomb" },
      { key: "copyDetails", label: "Másolás gomb" },
      { key: "copied", label: "Sikeres másolás visszajelzése" }
    ]
  },
  {
    title: "Foglalás kezelése és kapcsolat",
    description: "A módosítási link mellett és az oldal alján megjelenő állandó szövegek.",
    fields: [
      { key: "manage", label: "Foglaláskezelés címe és gombja" },
      { key: "manageText", label: "Foglaláskezelés leírása", multiline: true },
      { key: "keepPage", label: "Oldal elmentésére buzdító szöveg", multiline: true },
      { key: "contact", label: "Kapcsolati rész címe" }
    ]
  }
];

function LanguageFields({
  language,
  title,
  content
}: {
  language: "hu" | "de";
  title: string;
  content: MiniSessionConfirmationLanguageContent;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 border-b border-ink/10 pb-3">
        <Languages size={18} className="text-brass" />
        <h3 className="text-base font-semibold text-ink">{title}</h3>
      </div>

      {FIELD_GROUPS.map((group) => (
        <fieldset key={group.title} className="rounded-lg border border-ink/10 bg-paper/60 p-4">
          <legend className="px-1 text-sm font-semibold text-ink">{group.title}</legend>
          <p className="mt-1 text-xs leading-5 text-graphite/60">{group.description}</p>
          <div className="mt-4 grid gap-4">
            {group.fields.map((field) => (
              <label key={field.key} className="block space-y-2">
                <span className="text-sm font-medium text-graphite">{field.label}</span>
                {field.multiline ? (
                  <textarea
                    name={`${language}__${field.key}`}
                    defaultValue={content[field.key]}
                    rows={3}
                    required
                    maxLength={600}
                    className="w-full resize-y rounded-md border border-ink/15 bg-white px-3 py-3 text-sm leading-6 outline-none transition focus:border-ink/50"
                  />
                ) : (
                  <input
                    name={`${language}__${field.key}`}
                    defaultValue={content[field.key]}
                    required
                    maxLength={180}
                    className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm outline-none transition focus:border-ink/50"
                  />
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function MiniSessionConfirmationSettings({
  content: storedContent,
  businessName,
  contactEmail,
  contactPhone
}: MiniSessionConfirmationSettingsProps) {
  const content = resolveMiniSessionConfirmationContent(storedContent);

  return (
    <form action={updateMiniSessionConfirmationSettingsAction} className="space-y-6">
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brass">Mini session</p>
            <h2 className="mt-2 text-xl font-semibold text-ink">Megerősítő landing page</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/70">
              Itt azokat az állandó adatokat és szövegeket módosíthatod, amelyek nem az adott foglalásból származnak. Az időpont, helyszín, név, létszám és az ügyfél e-mail-címe továbbra is automatikusan töltődik ki.
            </p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
            <Settings2 size={20} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <MessageSquareText size={20} className="text-brass" />
          <div>
            <h2 className="text-lg font-semibold text-ink">Fejléc és kapcsolati adatok</h2>
            <p className="mt-1 text-sm text-graphite/65">Ezek mindkét nyelvű megerősítő oldalon azonosak.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-graphite">Vállalkozás neve a fejlécben</span>
            <input name="businessName" defaultValue={businessName} required maxLength={180} className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Kapcsolati e-mail</span>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite/45" size={16} />
              <input name="contactEmail" type="email" defaultValue={contactEmail ?? ""} placeholder="hello@example.com" className="h-12 w-full rounded-md border border-ink/15 bg-paper pl-10 pr-3 outline-none transition focus:border-ink/50" />
            </div>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Kapcsolati telefonszám</span>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite/45" size={16} />
              <input name="contactPhone" defaultValue={contactPhone ?? ""} placeholder="+43 ..." maxLength={80} className="h-12 w-full rounded-md border border-ink/15 bg-paper pl-10 pr-3 outline-none transition focus:border-ink/50" />
            </div>
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-soft sm:p-6">
        <div className="grid gap-8 xl:grid-cols-2">
          <LanguageFields language="de" title="Német szövegek" content={content.de} />
          <LanguageFields language="hu" title="Magyar szövegek" content={content.hu} />
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex justify-end rounded-lg border border-ink/10 bg-white/95 p-4 shadow-soft backdrop-blur">
        <FormSubmitButton pendingLabel="Mentés..." className="min-w-52">
          <Save size={17} />
          Megerősítő oldal mentése
        </FormSubmitButton>
      </div>
    </form>
  );
}
