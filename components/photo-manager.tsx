import Image from "next/image";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImageIcon, Star, Trash2 } from "lucide-react";
import {
  deletePhotoAction,
  movePhotoAction,
  restoreClientHiddenPhotoAction,
  setCoverPhotoAction
} from "@/lib/gallery-actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState } from "@/components/empty-state";

type Photo = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  sortOrder: number;
  isClientHidden: boolean;
  clientHiddenAt: Date | null;
};

export function PhotoManager({
  coverPhotoId,
  galleryId,
  photos
}: {
  coverPhotoId: string | null;
  galleryId: string;
  photos: Photo[];
}) {
  return (
    <section>
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink">Fotók kezelése</h2>
        <p className="mt-1 text-sm text-graphite/70">Rendezés, borítókép választás és egyedi törlés.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo, index) => (
          <div key={photo.id} className="overflow-hidden rounded-lg border border-ink/10 bg-white">
            <div className="relative aspect-[4/3] bg-mist">
              <Image
                src={photo.thumbnailUrl}
                alt={photo.filename}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 33vw, 50vw"
              />
              {coverPhotoId === photo.id ? (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-ink">
                  <Star size={13} />
                  Borító
                </span>
              ) : null}
              {photo.isClientHidden ? (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-ink/85 px-2.5 py-1 text-xs font-medium text-white">
                  <EyeOff size={13} />
                  Ügyfél elrejtette
                </span>
              ) : null}
            </div>
            <div className="space-y-3 p-3">
              <div>
                <p className="truncate text-sm font-medium text-ink">{photo.filename}</p>
                <p className="mt-1 text-xs text-graphite/70">Sorrend: {index + 1}</p>
                {photo.clientHiddenAt ? (
                  <p className="mt-1 text-xs text-brass">
                    Elrejtve:{" "}
                    {photo.clientHiddenAt.toLocaleString("hu-HU", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <form action={movePhotoAction.bind(null, galleryId, photo.id, "up")}>
                  <button
                    title="Előrébb"
                    disabled={index === 0}
                    className="flex h-9 w-full items-center justify-center rounded-md border border-ink/10 text-graphite transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUp size={16} />
                  </button>
                </form>
                <form action={movePhotoAction.bind(null, galleryId, photo.id, "down")}>
                  <button
                    title="Hátrébb"
                    disabled={index === photos.length - 1}
                    className="flex h-9 w-full items-center justify-center rounded-md border border-ink/10 text-graphite transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowDown size={16} />
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-2">
                <form action={setCoverPhotoAction.bind(null, galleryId, photo.id)}>
                  <button
                    disabled={coverPhotoId === photo.id}
                    className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm text-graphite transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:bg-sage/10 disabled:text-sage"
                  >
                    <Star size={15} />
                    {coverPhotoId === photo.id ? "Borítókép" : "Legyen borító"}
                  </button>
                </form>
                <form action={deletePhotoAction.bind(null, photo.id, galleryId)}>
                  <ConfirmSubmitButton
                    title="Fotó törlése"
                    message="Biztosan törlöd ezt a fotót? A feltöltött képfájl is törlődik."
                    variant="danger"
                    className="size-9 px-0"
                  >
                    <Trash2 size={16} />
                  </ConfirmSubmitButton>
                </form>
              </div>

              {photo.isClientHidden ? (
                <form action={restoreClientHiddenPhotoAction.bind(null, galleryId, photo.id)}>
                  <button className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-brass/30 bg-brass/10 px-3 text-sm text-brass transition hover:bg-brass/15">
                    <Eye size={15} />
                    Visszatenni publikusba
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ))}
        {photos.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState
              icon={<ImageIcon size={22} />}
              title="Még nincs fotó"
              description="Tölts fel képeket, majd itt tudod rendezni őket és borítóképet választani."
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
