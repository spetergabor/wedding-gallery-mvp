import { CalendarDays, FileText, IdCard, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { updatePhotographerProfileAction } from "@/lib/settings-actions";

type PhotographerProfileSettingsProps = {
  profile: {
    name: string;
    email: string;
    legalName: string | null;
    birthDate: Date | null;
    birthPlace: string | null;
    phone: string | null;
    addressLine: string | null;
    postalCode: string | null;
    city: string | null;
    country: string | null;
    taxNumber: string | null;
    businessRegistrationNumber: string | null;
    profileNotes: string | null;
  };
};

function dateInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function PhotographerProfileSettings({ profile }: PhotographerProfileSettingsProps) {
  return (
    <form action={updatePhotographerProfileAction} className="space-y-6">
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Fotós adatok</h2>
            <p className="mt-1 text-sm text-graphite/70">
              Ezek a fiókhoz tartozó személyes és hivatalos adatok. A név a szerződés aláírás blokkjában is ezt követi.
            </p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
            <UserRound size={20} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Megjelenő név</span>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite/50" size={16} />
              <input
                name="name"
                defaultValue={profile.name}
                required
                autoComplete="name"
                className="h-12 w-full rounded-md border border-ink/15 bg-paper pl-10 pr-3 outline-none transition focus:border-ink/50"
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Belépési email</span>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite/50" size={16} />
              <input
                name="email"
                type="email"
                defaultValue={profile.email}
                required
                autoComplete="email"
                className="h-12 w-full rounded-md border border-ink/15 bg-paper pl-10 pr-3 outline-none transition focus:border-ink/50"
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Hivatalos / számlázási név</span>
            <div className="relative">
              <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite/50" size={16} />
              <input
                name="legalName"
                defaultValue={profile.legalName ?? ""}
                placeholder="pl. Peter Schulcz e.U."
                className="h-12 w-full rounded-md border border-ink/15 bg-paper pl-10 pr-3 outline-none transition focus:border-ink/50"
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Telefon</span>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite/50" size={16} />
              <input
                name="phone"
                defaultValue={profile.phone ?? ""}
                placeholder="+43 ..."
                autoComplete="tel"
                className="h-12 w-full rounded-md border border-ink/15 bg-paper pl-10 pr-3 outline-none transition focus:border-ink/50"
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Születési dátum</span>
            <div className="relative">
              <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite/50" size={16} />
              <input
                name="birthDate"
                type="date"
                defaultValue={dateInputValue(profile.birthDate)}
                className="h-12 w-full rounded-md border border-ink/15 bg-paper pl-10 pr-3 outline-none transition focus:border-ink/50"
              />
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Születési hely</span>
            <input
              name="birthPlace"
              defaultValue={profile.birthPlace ?? ""}
              placeholder="pl. Graz"
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Cím és hivatalos adatok</h2>
            <p className="mt-1 text-sm text-graphite/70">
              Ezek később szerződés- és számlasablonokhoz is felhasználhatók.
            </p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
            <MapPin size={20} />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-graphite">Cím / székhely</span>
            <input
              name="addressLine"
              defaultValue={profile.addressLine ?? ""}
              placeholder="Utca, házszám"
              autoComplete="street-address"
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Irányítószám</span>
            <input
              name="postalCode"
              defaultValue={profile.postalCode ?? ""}
              autoComplete="postal-code"
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Város</span>
            <input
              name="city"
              defaultValue={profile.city ?? ""}
              autoComplete="address-level2"
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Ország</span>
            <input
              name="country"
              defaultValue={profile.country ?? ""}
              placeholder="pl. Austria"
              autoComplete="country-name"
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Adószám / UID</span>
            <input
              name="taxNumber"
              defaultValue={profile.taxNumber ?? ""}
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
            />
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-graphite">Cégjegyzék / vállalkozói nyilvántartási szám</span>
            <input
              name="businessRegistrationNumber"
              defaultValue={profile.businessRegistrationNumber ?? ""}
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
            <FileText size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-ink">Belső megjegyzés</h2>
            <p className="mt-1 text-sm text-graphite/70">
              Csak admin célra, későbbi szerződés/számla automatizáláshoz vagy belső emlékeztetőnek.
            </p>
            <textarea
              name="profileNotes"
              defaultValue={profile.profileNotes ?? ""}
              rows={4}
              className="mt-4 w-full rounded-md border border-ink/15 bg-paper px-3 py-3 outline-none transition focus:border-ink/50"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <FormSubmitButton pendingLabel="Fotós adatok mentése...">Fotós adatok mentése</FormSubmitButton>
        <p className="text-sm text-graphite/70">A név módosítása a szerződéses fotós névnél is megjelenik.</p>
      </div>
    </form>
  );
}
