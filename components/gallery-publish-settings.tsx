"use client";

import { Check, CreditCard, Download, Eye, ShieldCheck } from "lucide-react";
import { useState } from "react";
import {
  GALLERY_DELIVERY_FREE_DOWNLOAD,
  GALLERY_DELIVERY_PAID,
  GALLERY_DELIVERY_VIEW_ONLY,
  normalizeGalleryDeliveryMode
} from "@/lib/gallery-delivery";
import { formatPriceInput } from "@/lib/gallery-sale-pricing";

type PricingTierRow = {
  from: number | null;
  to: number | null;
  unitPriceCents: number | null;
};

type GalleryPublishSettingsProps = {
  defaultIsActive: boolean;
  defaultDeliveryMode: string;
  stripeReady: boolean;
  paidModeAvailable: boolean;
  salePriceCents: number;
  saleUnitPriceCents: number;
  salePricingTiers: PricingTierRow[];
  saleCurrency: string;
};

const inputClass =
  "h-12 w-full rounded-md border border-ink/15 bg-white px-3 outline-none transition placeholder:text-graphite/45 focus:border-ink/50";
const saleCurrencies = ["eur", "usd", "gbp", "chf"] as const;
type SaleCurrency = (typeof saleCurrencies)[number];

export function GalleryPublishSettings({
  defaultIsActive,
  defaultDeliveryMode,
  stripeReady,
  paidModeAvailable,
  salePriceCents,
  saleUnitPriceCents,
  salePricingTiers,
  saleCurrency
}: GalleryPublishSettingsProps) {
  const [deliveryMode, setDeliveryMode] = useState(normalizeGalleryDeliveryMode(defaultDeliveryMode));
  const paidSelected = deliveryMode === GALLERY_DELIVERY_PAID;
  const normalizedCurrency = normalizeSaleCurrency(saleCurrency);
  const deliveryOptions = [
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
      description: "A vendég letöltési lehetőséget kap, fizetés nélkül."
    },
    {
      value: GALLERY_DELIVERY_PAID,
      icon: <CreditCard size={15} />,
      title: "Megvásárolható galéria",
      description: stripeReady
        ? "A vendég preview képeket lát, a teljes felbontás fizetés után lesz elérhető."
        : "Előbb kösd össze a saját Stripe fiókodat a Beállítások > Integrációk alatt."
    }
  ];

  return (
    <section className="rounded-md border border-ink/10 bg-paper p-4">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brass">Publikus működés</p>
            <h3 className="mt-2 text-lg font-semibold text-ink">Láthatóság és galéria típusa</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-graphite/70">
              Itt döntöd el, hogy a galéria aktív legyen-e, és a vendég ingyenesen nézze, töltse vagy vásárolja meg a képeket.
            </p>
          </div>
          {paidSelected && salePriceCents > 0 ? (
            <span className="w-fit rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass">
              {formatGallerySalePrice(salePriceCents, normalizedCurrency)}
            </span>
          ) : null}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-ink/10 bg-white px-4 py-4 transition hover:border-ink/20">
          <span className="relative mt-1 flex size-5 shrink-0 items-center justify-center rounded border border-ink/20 bg-white">
            <input name="isActive" type="checkbox" defaultChecked={defaultIsActive} className="peer absolute inset-0 cursor-pointer opacity-0" />
            <Check className="hidden text-ink peer-checked:block" size={14} />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <ShieldCheck size={15} />
              Aktív galéria
            </span>
            <span className="mt-1 block text-sm leading-6 text-graphite/70">
              Csak aktív állapotban érhető el a publikus link. Ha lekapcsolod, a vendégoldal nem nyitható meg.
            </span>
          </span>
        </label>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-graphite">Átadás típusa</legend>
          <div className="grid gap-3 lg:grid-cols-3">
            {deliveryOptions.map((option) => {
              const checked = deliveryMode === option.value;
              const disabled = option.value === GALLERY_DELIVERY_PAID && !paidModeAvailable;

              return (
                <label
                  key={option.value}
                  className={`flex min-h-32 cursor-pointer items-start gap-3 rounded-md border px-4 py-4 transition ${
                    disabled
                      ? "cursor-not-allowed border-ink/10 bg-ink/[0.03] opacity-60"
                      : checked
                        ? "border-ink bg-white shadow-soft"
                        : "border-ink/10 bg-white hover:border-ink/25"
                  }`}
                >
                  <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-ink/20 bg-white">
                    <input
                      name="deliveryMode"
                      type="radio"
                      value={option.value}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => setDeliveryMode(normalizeGalleryDeliveryMode(option.value))}
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
        </fieldset>

        {paidSelected ? (
          <section className="rounded-md border border-brass/20 bg-brass/[0.04] p-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-brass">
                <CreditCard size={15} />
                Vásárlás és árak
              </p>
              <h3 className="mt-2 text-lg font-semibold text-ink">Fizetős galéria árazása</h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-graphite/70">
                Itt állíthatod be a teljes galéria árát, az egyedi képek darabárát és a mennyiségi sávokat.
              </p>
              <p className="mt-2 text-xs leading-5 text-graphite/60">
                0,00 árral Stripe teszt Checkout indul kártyaadat nélkül. Ha a teszt bankkártyás mezőt is látni akarod, adj meg
                kis összeget, például 0,50 EUR-t Stripe test módban.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_140px]">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Teljes galéria ára</span>
                <input
                  name="salePrice"
                  inputMode="decimal"
                  defaultValue={salePriceInputValue(salePriceCents)}
                  placeholder="pl. 49,00"
                  className={inputClass}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Alap darabár / kép</span>
                <input
                  name="saleUnitPrice"
                  inputMode="decimal"
                  defaultValue={formatPriceInput(saleUnitPriceCents)}
                  placeholder="pl. 6,00"
                  className={inputClass}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Deviza</span>
                <select name="saleCurrency" defaultValue={normalizedCurrency} className={inputClass}>
                  <option value="eur">EUR</option>
                  <option value="usd">USD</option>
                  <option value="gbp">GBP</option>
                  <option value="chf">CHF</option>
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-md border border-ink/10 bg-white p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">Sávos képenkénti ár</p>
                  <p className="mt-1 text-xs leading-5 text-graphite/65">
                    Progresszív árképzés: például 1-10 kép 15 EUR/db, 11-15 kép 10 EUR/db. A kedvezmény csak az adott sávba eső
                    plusz képekre vonatkozik.
                  </p>
                </div>
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/45">opcionális</span>
              </div>
              <div className="mt-3 space-y-2">
                {salePricingTiers.map((tier, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.3fr]">
                    <label className="block space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-graphite/55">Mettől</span>
                      <input
                        name="saleTierFrom"
                        inputMode="numeric"
                        defaultValue={tier.from ?? ""}
                        placeholder={index === 0 ? "1" : ""}
                        className="h-10 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm outline-none transition focus:border-ink/50"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-graphite/55">Meddig</span>
                      <input
                        name="saleTierTo"
                        inputMode="numeric"
                        defaultValue={tier.to ?? ""}
                        placeholder={index === 2 ? "üres = nincs felső határ" : "10"}
                        className="h-10 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm outline-none transition focus:border-ink/50"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-graphite/55">Darabár</span>
                      <input
                        name="saleTierPrice"
                        inputMode="decimal"
                        defaultValue={formatPriceInput(tier.unitPriceCents)}
                        placeholder="pl. 5,00"
                        className="h-10 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm outline-none transition focus:border-ink/50"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function normalizeSaleCurrency(value: string | null | undefined): SaleCurrency {
  const normalized = value?.trim().toLowerCase();

  return saleCurrencies.includes(normalized as SaleCurrency) ? (normalized as SaleCurrency) : "eur";
}

function formatGallerySalePrice(cents: number | null | undefined, currency: string | null | undefined) {
  const amount = Math.max(0, cents ?? 0) / 100;

  return new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: normalizeSaleCurrency(currency).toUpperCase()
  }).format(amount);
}

function salePriceInputValue(cents: number | null | undefined) {
  if (!cents) {
    return "";
  }

  return (cents / 100).toFixed(2).replace(".", ",");
}
