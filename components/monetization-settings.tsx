import { HardDrive, PackageCheck, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import {
  createSubscriptionPlanAction,
  deleteSubscriptionPlanAction,
  updateSubscriptionPlanAction
} from "@/lib/monetization-actions";
import { formatPlanPrice, formatStorageLimit, MONETIZATION_FEATURES } from "@/lib/monetization";

type MonetizationPlan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthlyPriceCents: number;
  currency: string;
  storageLimitGb: number | null;
  featureGallery: boolean;
  featureAlbum: boolean;
  featureContracts: boolean;
  featureBooking: boolean;
  featureStripe: boolean;
  isActive: boolean;
  sortOrder: number;
  _count: {
    adminOverrides: number;
  };
};

function defaultFeatureChecked(plan: MonetizationPlan | undefined, key: (typeof MONETIZATION_FEATURES)[number]["key"]) {
  return plan ? Boolean(plan[key]) : key === "featureGallery";
}

export function MonetizationSettings({ plans }: { plans: MonetizationPlan[] }) {
  return (
    <div className="space-y-5">
      <section className="rounded-md border border-brass/20 bg-white p-5 shadow-[0_1px_0_rgba(178,139,78,0.08)] sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-brass">
              <PackageCheck size={15} />
              Szuperadmin
            </div>
            <h2 className="mt-2 text-xl font-semibold text-ink">Monetizáció előkészítés</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/70">
              Itt készítheted elő a későbbi előfizetési csomagokat. Ez még nem kapcsol be automatikus számlázást vagy korlátozást, de már megvan a csomag, tárhelykeret és feature flag alap.
            </p>
          </div>
          <div className="rounded-md border border-ink/10 bg-paper px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/55">Aktív csomagok</p>
            <p className="mt-1 text-3xl font-semibold text-ink">{plans.filter((plan) => plan.isActive).length}</p>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-ink text-white">
            <Plus size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-ink">Új csomag létrehozása</h2>
            <p className="mt-1 text-sm text-graphite/70">Adj hozzá olyan csomagot, amit később fotósokhoz vagy Stripe előfizetéshez tudsz kötni.</p>
          </div>
        </div>
        <PlanForm mode="create" />
      </section>

      <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col justify-between gap-3 border-b border-ink/10 pb-4 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-brass">
              <ShieldCheck size={15} />
              Csomagok
            </div>
            <h2 className="mt-2 text-lg font-semibold text-ink">Elérhető csomagok</h2>
          </div>
          <span className="w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
            {plans.length} csomag
          </span>
        </div>

        {plans.length === 0 ? (
          <div className="mt-5 rounded-md bg-paper px-4 py-4 text-sm text-graphite/70">
            Még nincs csomag. Hozz létre legalább egy alap csomagot, utána fotóshoz is hozzá tudod rendelni.
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {plans.map((plan) => (
              <article key={plan.id} className="rounded-md border border-ink/10 bg-paper/40 p-4">
                <div className="flex flex-col justify-between gap-3 border-b border-ink/10 pb-4 md:flex-row md:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-ink">{plan.name}</h3>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-graphite">{plan.slug}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${plan.isActive ? "bg-sage/12 text-sage" : "bg-ink/5 text-graphite"}`}>
                        {plan.isActive ? "Aktív" : "Rejtett"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-graphite/70">
                      {formatPlanPrice(plan.monthlyPriceCents, plan.currency)} · {formatStorageLimit(plan.storageLimitGb)} tárhely · {plan._count.adminOverrides} fotóshoz rendelve
                    </p>
                  </div>
                  <form action={deleteSubscriptionPlanAction.bind(null, plan.id)}>
                    <ConfirmSubmitButton
                      variant="danger"
                      message={`Biztosan törlöd vagy elrejted ezt a csomagot: ${plan.name}?`}
                      className="w-full md:w-auto"
                    >
                      <Trash2 size={16} />
                      Törlés
                    </ConfirmSubmitButton>
                  </form>
                </div>
                <PlanForm mode="update" plan={plan} />
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PlanForm({ mode, plan }: { mode: "create" | "update"; plan?: MonetizationPlan }) {
  const action = mode === "update" && plan ? updateSubscriptionPlanAction.bind(null, plan.id) : createSubscriptionPlanAction;

  return (
    <form action={action} className="mt-5 space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_0.7fr_0.7fr]">
        <label className="grid gap-2 text-sm font-medium text-ink">
          Csomag neve
          <input
            name="name"
            required
            defaultValue={plan?.name ?? ""}
            placeholder="pl. Starter"
            className="h-11 rounded-md border border-ink/12 bg-white px-3 text-sm outline-none transition focus:border-ink/35"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-ink">
          Slug
          <input
            name="slug"
            defaultValue={plan?.slug ?? ""}
            placeholder="starter"
            className="h-11 rounded-md border border-ink/12 bg-white px-3 text-sm outline-none transition focus:border-ink/35"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-ink">
          Havi ár
          <input
            name="monthlyPrice"
            inputMode="decimal"
            defaultValue={plan ? (plan.monthlyPriceCents / 100).toLocaleString("hu-HU", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : ""}
            placeholder="0"
            className="h-11 rounded-md border border-ink/12 bg-white px-3 text-sm outline-none transition focus:border-ink/35"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-ink">
          Deviza
          <input
            name="currency"
            defaultValue={plan?.currency ?? "EUR"}
            className="h-11 rounded-md border border-ink/12 bg-white px-3 text-sm uppercase outline-none transition focus:border-ink/35"
          />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.4fr]">
        <label className="grid gap-2 text-sm font-medium text-ink">
          Leírás
          <textarea
            name="description"
            defaultValue={plan?.description ?? ""}
            rows={3}
            placeholder="Rövid belső megjegyzés a csomagról."
            className="rounded-md border border-ink/12 bg-white px-3 py-2 text-sm outline-none transition focus:border-ink/35"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <label className="grid gap-2 text-sm font-medium text-ink">
            Tárhelykeret GB
            <input
              name="storageLimitGb"
              inputMode="numeric"
              defaultValue={plan?.storageLimitGb ?? ""}
              placeholder="üres = korlátlan"
              className="h-11 rounded-md border border-ink/12 bg-white px-3 text-sm outline-none transition focus:border-ink/35"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-ink">
            Sorrend
            <input
              name="sortOrder"
              inputMode="numeric"
              defaultValue={plan?.sortOrder ?? 0}
              className="h-11 rounded-md border border-ink/12 bg-white px-3 text-sm outline-none transition focus:border-ink/35"
            />
          </label>
        </div>
      </div>

      <div className="rounded-md border border-ink/10 bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <HardDrive size={16} />
          Funkciók és állapot
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MONETIZATION_FEATURES.map((feature) => (
            <label key={feature.key} className="flex items-center gap-3 rounded-md border border-ink/10 bg-paper/60 px-3 py-3 text-sm font-medium text-ink">
              <input
                type="checkbox"
                name={feature.key}
                defaultChecked={defaultFeatureChecked(plan, feature.key)}
                className="size-4 rounded border-ink/25 accent-ink"
              />
              {feature.label}
            </label>
          ))}
          <label className="flex items-center gap-3 rounded-md border border-ink/10 bg-paper/60 px-3 py-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={plan?.isActive ?? true}
              className="size-4 rounded border-ink/25 accent-ink"
            />
            Csomag aktív
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <FormSubmitButton pendingLabel="Mentés..." className="w-full sm:w-auto">
          {mode === "create" ? <Plus size={16} /> : <Save size={16} />}
          {mode === "create" ? "Csomag létrehozása" : "Csomag mentése"}
        </FormSubmitButton>
      </div>
    </form>
  );
}
