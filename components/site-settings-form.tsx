import Image from "next/image";
import { Building2, FileSignature, Globe2, ImageIcon, Instagram, Mail, Phone, Youtube } from "lucide-react";
import { updateSiteSettingsAction } from "@/lib/settings-actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { LogoHeightControl } from "@/components/logo-height-control";

type SiteSettingsFormProps = {
  adminName: string;
  settings: {
    businessName: string;
    logoUrl: string | null;
    logoHeight: number;
    signatureUrl: string | null;
    websiteUrl: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    tiktokUrl: string | null;
    youtubeUrl: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
};

export function SiteSettingsForm({ adminName, settings }: SiteSettingsFormProps) {
  const contractPhotographerName = adminName.trim() || settings.businessName.trim() || "Fotós";
  const logoHeight = Math.min(140, Math.max(32, settings.logoHeight || 80));

  return (
    <form action={updateSiteSettingsAction} className="space-y-6">
      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Márka adatok</h2>
            <p className="mt-1 text-sm text-graphite/70">Ezek jelennek meg az admin felületen és később a publikus galériák márkázásában.</p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
            <Building2 size={20} />
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">Vállalkozás neve</span>
              <input
                name="businessName"
                defaultValue={settings.businessName}
                placeholder="pl. Hochzeitsfotograf Graz"
                className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">Weboldal</span>
              <div className="relative">
                <Globe2 className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite/50" size={16} />
                <input
                  name="websiteUrl"
                  defaultValue={settings.websiteUrl ?? ""}
                  placeholder="https://hochzeitsfotografgraz.at"
                  className="h-12 w-full rounded-md border border-ink/15 bg-paper pl-10 pr-3 outline-none transition focus:border-ink/50"
                />
              </div>
            </label>

            <LogoHeightControl defaultValue={logoHeight} />
          </div>

          <div className="rounded-lg border border-ink/10 bg-paper p-4">
            <div className="flex min-h-36 items-center justify-center rounded-md bg-white">
              {settings.logoUrl ? (
                <Image
                  src={settings.logoUrl}
                  alt="Aktuális logó"
                  width={260}
                  height={140}
                  unoptimized
                  className="w-auto object-contain"
                  style={{ height: `${logoHeight}px`, maxWidth: "100%" }}
                />
              ) : (
                <div className="text-center text-graphite/60">
                  <ImageIcon className="mx-auto" size={24} />
                  <p className="mt-2 text-sm">Nincs feltöltött logó</p>
                </div>
              )}
            </div>
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium text-graphite">Logó feltöltése</span>
              <input
                name="logo"
                type="file"
                accept="image/*"
                className="block w-full text-sm text-graphite file:mr-3 file:h-10 file:rounded-md file:border-0 file:bg-ink file:px-3 file:text-sm file:font-medium file:text-white"
              />
            </label>
            {settings.logoUrl ? (
              <label className="mt-3 flex items-center gap-2 text-sm text-graphite">
                <input name="removeLogo" type="checkbox" className="size-4 rounded border-ink/20" />
                Logó eltávolítása
              </label>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">Szerződés aláírás</h2>
            <p className="mt-1 text-sm text-graphite/70">
              Ez a PNG aláírás kerül minden elkészült, aláírt szerződés végére a fotós neve mellé.
            </p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
            <FileSignature size={20} />
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="rounded-md border border-ink/10 bg-paper p-4 text-sm leading-6 text-graphite/70">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-ink">Fotós neve a szerződésben</span>
              <input
                name="adminName"
                defaultValue={contractPhotographerName}
                required
                autoComplete="name"
                className="h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-base font-semibold text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <p className="mt-4">
              A rendszer a fiókban megadott fotós nevet írja az aláírt PDF végére. Átlátszó hátterű PNG ajánlott.
            </p>
          </div>

          <div className="rounded-lg border border-ink/10 bg-paper p-4">
            <div className="flex min-h-36 items-center justify-center rounded-md bg-white">
              {settings.signatureUrl ? (
                <Image
                  src={settings.signatureUrl}
                  alt="Aktuális aláírás"
                  width={220}
                  height={120}
                  unoptimized
                  className="max-h-28 w-auto object-contain"
                />
              ) : (
                <div className="text-center text-graphite/60">
                  <FileSignature className="mx-auto" size={24} />
                  <p className="mt-2 text-sm">Nincs feltöltött aláírás</p>
                </div>
              )}
            </div>
            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium text-graphite">Aláírás PNG feltöltése</span>
              <input
                name="signature"
                type="file"
                accept="image/png,.png"
                className="block w-full text-sm text-graphite file:mr-3 file:h-10 file:rounded-md file:border-0 file:bg-ink file:px-3 file:text-sm file:font-medium file:text-white"
              />
            </label>
            {settings.signatureUrl ? (
              <label className="mt-3 flex items-center gap-2 text-sm text-graphite">
                <input name="removeSignature" type="checkbox" className="size-4 rounded border-ink/20" />
                Aláírás eltávolítása
              </label>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
        <h2 className="text-xl font-semibold text-ink">Elérhetőség és social linkek</h2>
        <p className="mt-1 text-sm text-graphite/70">Ezeket később a publikus galéria láblécében és email sablonokban is használhatjuk.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Email</span>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite/50" size={16} />
              <input
                name="contactEmail"
                type="email"
                defaultValue={settings.contactEmail ?? ""}
                placeholder="hello@example.com"
                className="h-12 w-full rounded-md border border-ink/15 bg-paper pl-10 pr-3 outline-none transition focus:border-ink/50"
              />
            </div>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Telefon</span>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite/50" size={16} />
              <input
                name="contactPhone"
                defaultValue={settings.contactPhone ?? ""}
                placeholder="+43 ..."
                className="h-12 w-full rounded-md border border-ink/15 bg-paper pl-10 pr-3 outline-none transition focus:border-ink/50"
              />
            </div>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Instagram</span>
            <div className="relative">
              <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite/50" size={16} />
              <input name="instagramUrl" defaultValue={settings.instagramUrl ?? ""} placeholder="https://instagram.com/..." className="h-12 w-full rounded-md border border-ink/15 bg-paper pl-10 pr-3 outline-none transition focus:border-ink/50" />
            </div>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Facebook</span>
            <input name="facebookUrl" defaultValue={settings.facebookUrl ?? ""} placeholder="https://facebook.com/..." className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">TikTok</span>
            <input name="tiktokUrl" defaultValue={settings.tiktokUrl ?? ""} placeholder="https://tiktok.com/@..." className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">YouTube</span>
            <div className="relative">
              <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite/50" size={16} />
              <input name="youtubeUrl" defaultValue={settings.youtubeUrl ?? ""} placeholder="https://youtube.com/..." className="h-12 w-full rounded-md border border-ink/15 bg-paper pl-10 pr-3 outline-none transition focus:border-ink/50" />
            </div>
          </label>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <FormSubmitButton>Beállítások mentése</FormSubmitButton>
        <p className="text-sm text-graphite/70">A márkaadatok azonnal frissülnek az admin felületen.</p>
      </div>
    </form>
  );
}
