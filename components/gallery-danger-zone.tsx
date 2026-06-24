import { Archive, RotateCcw, Trash2 } from "lucide-react";
import {
  activateGalleryAction,
  archiveGalleryAction,
  deleteGalleryAction
} from "@/lib/gallery-actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";

export function GalleryDangerZone({
  galleryId,
  isActive
}: {
  galleryId: string;
  isActive: boolean;
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-xl font-semibold text-ink">Publikálás és törlés</h2>
          <p className="mt-1 max-w-2xl text-sm text-graphite/70">
            Archiváláskor a galéria megmarad adminban, de a publikus link nem lesz elérhető. Törléskor a galéria, a fotó rekordok és a feltöltött képfájlok is törlődnek.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {isActive ? (
            <form action={archiveGalleryAction.bind(null, galleryId)}>
              <FormSubmitButton type="submit" variant="secondary" className="w-full sm:w-auto" pendingLabel="Archiválás...">
                <Archive size={16} />
                Archiválás
              </FormSubmitButton>
            </form>
          ) : (
            <form action={activateGalleryAction.bind(null, galleryId)}>
              <FormSubmitButton type="submit" variant="secondary" className="w-full sm:w-auto" pendingLabel="Aktiválás...">
                <RotateCcw size={16} />
                Aktiválás
              </FormSubmitButton>
            </form>
          )}

          <form action={deleteGalleryAction.bind(null, galleryId)}>
            <ConfirmSubmitButton
              variant="danger"
              message="Biztosan törlöd ezt a galériát? Ez a fotó rekordokat és a feltöltött képfájlokat is törli."
              className="w-full sm:w-auto"
            >
              <Trash2 size={16} />
              Törlés
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>
    </section>
  );
}
