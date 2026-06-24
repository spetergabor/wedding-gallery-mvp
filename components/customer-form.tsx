import { createCustomerAction, updateCustomerAction } from "@/lib/customer-actions";
import { Button, ButtonLink } from "@/components/button";
import { Calendar, Mail, MapPin, Pencil, Phone, StickyNote, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { CUSTOMER_STATUSES, CUSTOMER_TYPES, customerStatusLabel, customerTypeLabel, normalizeCustomerStatus } from "@/lib/customer-options";
import { CUSTOMER_LANGUAGES, customerLanguageLabel, normalizeCustomerLanguage } from "@/lib/customer-language";

type CustomerFormValue = {
  id: string;
  customerType: string;
  coupleName: string;
  primaryEmail: string;
  secondaryEmail: string | null;
  phone: string | null;
  weddingDate: Date | null;
  venue: string | null;
  status: string;
  notes: string | null;
  preferredLanguage: string;
};

function dateInputValue(date: Date | null | undefined) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function displayDate(date: Date | null | undefined) {
  if (!date) {
    return "Nincs dátum megadva";
  }

  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

function detailValue(value: string | null | undefined) {
  return value?.trim() || "Nincs megadva";
}

function DetailItem({
  icon: Icon,
  label,
  value
}: {
  icon: typeof UserRound;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-md border border-ink/10 bg-paper px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-graphite/55">
        <Icon size={14} />
        {label}
      </div>
      <div className="mt-2 text-base font-medium text-ink">{value}</div>
    </div>
  );
}

export function CustomerProfileCard({ customer }: { customer: CustomerFormValue }) {
  const status = customerStatusLabel(customer.status);
  const typeLabel = customerTypeLabel(customer.customerType);

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
      <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-brass">Ügyfél adatlap</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{customer.coupleName}</h2>
          <p className="mt-2 text-sm text-graphite/70">
            {typeLabel} · {status} · {displayDate(customer.weddingDate)}
          </p>
        </div>
        <ButtonLink href={`/admin/clients/${customer.id}?edit=1`} variant="secondary">
          <Pencil size={16} />
          Szerkesztés
        </ButtonLink>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <DetailItem icon={UserRound} label="Ügyfél / projekt" value={customer.coupleName} />
        <DetailItem icon={UserRound} label="Típus" value={typeLabel} />
        <DetailItem icon={Calendar} label="Dátum" value={displayDate(customer.weddingDate)} />
        <DetailItem icon={Mail} label="Elsődleges email" value={customer.primaryEmail} />
        <DetailItem icon={Mail} label="Másodlagos email" value={detailValue(customer.secondaryEmail)} />
        <DetailItem icon={Phone} label="Telefon" value={detailValue(customer.phone)} />
        <DetailItem icon={MapPin} label="Helyszín" value={detailValue(customer.venue)} />
        <DetailItem icon={Mail} label="Elsődleges nyelv" value={customerLanguageLabel(customer.preferredLanguage)} />
      </div>

      <div className="mt-3 rounded-md border border-ink/10 bg-paper px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-graphite/55">
          <StickyNote size={14} />
          Megjegyzések
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-graphite">
          {detailValue(customer.notes)}
        </p>
      </div>
    </section>
  );
}

export function CustomerForm({ customer }: { customer?: CustomerFormValue }) {
  const action = customer ? updateCustomerAction.bind(null, customer.id) : createCustomerAction;

  return (
    <form action={action} className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
      {customer ? (
        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-ink/10 pb-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-brass">Adatlap szerkesztése</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">{customer.coupleName}</h2>
          </div>
          <ButtonLink href={`/admin/clients/${customer.id}`} variant="ghost">
            Mégse
          </ButtonLink>
        </div>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Nyeró nyelv</span>
          <select
            name="preferredLanguage"
            defaultValue={normalizeCustomerLanguage(customer?.preferredLanguage)}
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          >
            {CUSTOMER_LANGUAGES.map((language) => (
              <option key={language.value} value={language.value}>
                {language.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Ügyféltípus</span>
          <select
            name="customerType"
            defaultValue={customer?.customerType ?? "wedding_couple"}
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          >
            {CUSTOMER_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Ügyfél / projekt neve</span>
          <input
            name="coupleName"
            defaultValue={customer?.coupleName ?? ""}
            required
            placeholder="pl. Esther und Oliver, Anna Müller, céges rendezvény"
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Elsődleges email</span>
          <input
            name="primaryEmail"
            type="email"
            defaultValue={customer?.primaryEmail ?? ""}
            required
            placeholder="email@example.com"
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Másodlagos email</span>
          <input
            name="secondaryEmail"
            type="email"
            defaultValue={customer?.secondaryEmail ?? ""}
            placeholder="opcionális"
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Telefon</span>
          <input
            name="phone"
            defaultValue={customer?.phone ?? ""}
            placeholder="+43 ..."
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Dátum</span>
          <input
            name="weddingDate"
            type="date"
            defaultValue={dateInputValue(customer?.weddingDate)}
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Helyszín</span>
          <input
            name="venue"
            defaultValue={customer?.venue ?? ""}
            placeholder="pl. Graz, Studio, rendezvényhelyszín..."
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-graphite">Státusz</span>
          <select
            name="status"
            defaultValue={normalizeCustomerStatus(customer?.status)}
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
          >
            {CUSTOMER_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-graphite">Megjegyzések</span>
          <textarea
            name="notes"
            defaultValue={customer?.notes ?? ""}
            rows={6}
            placeholder="Belső jegyzetek: csomag, fontos kérések, szerződéses megállapodások, projektinfók..."
            className="w-full rounded-md border border-ink/15 bg-paper px-3 py-3 text-ink outline-none transition focus:border-ink/50"
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <Button type="submit">{customer ? "Ügyfél mentése" : "Ügyfél létrehozása"}</Button>
      </div>
    </form>
  );
}
