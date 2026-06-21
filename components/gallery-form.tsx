import { CalendarDays, Check, Download, Eye, Images, LockKeyhole, Mail } from "lucide-react";
import { createGalleryAction, updateGalleryAction } from "@/lib/gallery-actions";
import { Button } from "@/components/button";
import { SlugFields } from "@/components/slug-fields";
import { GALLERY_MODE_FULL, GALLERY_MODE_PROOFING } from "@/lib/proofing";

type GalleryFormProps = {
  gallery?: {
    id: string;
    title: string;
    slug: string;
    password: string | null;
    eventDate: Date | null;
    isActive: boolean;
    galleryMode: string;
    downloadsEnabled: boolean;
    clientEmail: string | null;
  };
};

function dateInputValue(date: Date | null | undefined) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export function GalleryForm({ gallery }: GalleryFormProps) {
  const action = gallery
    ? updateGalleryAction.bind(null, gallery.id)
    : createGalleryAction;

  return (
    <form action={action} className="space-y-6 rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
      <div>
        <h2 className="text-xl font-semibold text-ink">Galéria adatai</h2>
        <p className="mt-1 text-sm text-graphite/70">A név alapján automatikusan készül a publikus link, de kézzel is átírható.</p>
      </div>

      <SlugFields defaultTitle={gallery?.title} defaultSlug={gallery?.slug} />

      <label className="space-y-2">
        <span className="flex items-center gap-2 text-sm font-medium text-graphite">
          <Images size={15} />
          Galéria típusa
        </span>
        <select
          name="galleryMode"
          defaultValue={gallery?.galleryMode ?? GALLERY_MODE_FULL}
          className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50 md:max-w-md"
        >
          <option value={GALLERY_MODE_FULL}>Teljes galéria</option>
          <option value={GALLERY_MODE_PROOFING}>Nyers képek válogatásra</option>
        </select>
        <span className="block text-xs text-graphite/70">
          Nyers válogatásnál az ügyfél kiválasztási státusza külön követhető lesz.
        </span>
      </label>

      <label className="space-y-2">
        <span className="flex items-center gap-2 text-sm font-medium text-graphite">
          <Mail size={15} />
          Ügyfél e-mail címe
        </span>
        <input
          name="clientEmail"
          type="email"
          defaultValue={gallery?.clientEmail ?? ""}
          placeholder="kunde@example.com"
          className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50 md:max-w-md"
        />
        <span className="block text-xs text-graphite/70">
          Nyers válogatásnál ide küldjük ki automatikusan a privát válogató linket a raw feltöltés végén.
        </span>
      </label>

      <label className="space-y-2">
        <span className="flex items-center gap-2 text-sm font-medium text-graphite">
          <CalendarDays size={15} />
          Esemény dátuma
        </span>
        <input
          name="eventDate"
          type="date"
          defaultValue={dateInputValue(gallery?.eventDate)}
          className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50 md:max-w-xs"
        />
        <span className="block text-xs text-graphite/70">Ez jelenik meg a publikus galéria borító szövegében.</span>
      </label>

      <label className="space-y-2">
        <span className="flex items-center gap-2 text-sm font-medium text-graphite">
          <LockKeyhole size={15} />
          Galéria jelszó
        </span>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <input
            name="password"
            defaultValue={gallery?.password ?? ""}
            placeholder="Opcionális"
            className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
          />
          <span className="text-xs text-graphite/70">Üresen hagyva publikus linkkel nyitható.</span>
        </div>
      </label>

      <label className="flex items-center gap-3 rounded-md border border-ink/10 bg-paper px-4 py-3 transition hover:border-ink/20">
        <span className="relative flex size-5 items-center justify-center rounded border border-ink/20 bg-white">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={gallery?.isActive}
            className="peer absolute inset-0 opacity-0"
          />
          <Check className="hidden text-ink peer-checked:block" size={14} />
        </span>
        <span>
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            <Eye size={15} />
            Aktív galéria
          </span>
          <span className="text-sm text-graphite/70">Csak aktív galéria érhető el a publikus linken.</span>
        </span>
      </label>

      <label className="flex items-center gap-3 rounded-md border border-ink/10 bg-paper px-4 py-3 transition hover:border-ink/20">
        <span className="relative flex size-5 items-center justify-center rounded border border-ink/20 bg-white">
          <input
            name="downloadsEnabled"
            type="checkbox"
            defaultChecked={gallery?.downloadsEnabled ?? true}
            className="peer absolute inset-0 opacity-0"
          />
          <Check className="hidden text-ink peer-checked:block" size={14} />
        </span>
        <span>
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            <Download size={15} />
            Letöltések engedélyezése
          </span>
          <span className="text-sm text-graphite/70">Ha ki van kapcsolva, a teljes ZIP és az egyes képek letöltése sem elérhető a vendégeknek.</span>
        </span>
      </label>

      <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center">
        <Button type="submit">{gallery ? "Módosítások mentése" : "Galéria létrehozása"}</Button>
        <p className="text-sm text-graphite/70">A módosítások azonnal érvényesek a publikus galérián.</p>
      </div>
    </form>
  );
}
