import Image from "next/image";
import { ArrowDown, ArrowUp, ImageIcon, Star, Trash2 } from "lucide-react";
import {
  deletePhotoAction,
  movePhotoAction,
  setCoverPhotoAction
} from "@/lib/gallery-actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState } from "@/components/empty-state";
import { PhotoUploadForm } from "@/components/photo-upload-form";

type Photo = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  sortOrder: number;
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
    <section className="space-y-6">
      <PhotoUploadForm galleryId={galleryId} />

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
            </div>
            <div className="space-y-3 p-3">
              <div>
                <p className="truncate text-sm font-medium text-ink">{photo.filename}</p>
                <p className="mt-1 text-xs text-graphite/70">Sorrend: {index + 1}</p>
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
