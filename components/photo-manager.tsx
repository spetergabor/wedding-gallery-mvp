import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, Clock3, Eye, EyeOff, Film, ImageIcon, Star, Trash2 } from "lucide-react";
import {
  deletePhotoAction,
  movePhotoAction,
  reorderGalleryPhotosAction,
  restoreClientHiddenPhotoAction,
  setCoverPhotoAction
} from "@/lib/gallery-actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState } from "@/components/empty-state";
import {
  PHOTO_DELIVERY_STAGE_FINAL,
  PHOTO_DELIVERY_STAGE_RAW,
  isProofingGallery,
  photoDeliveryStageLabel
} from "@/lib/proofing";

type Photo = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  deliveryStage: string;
  mediaType: string;
  sortOrder: number;
  isClientHidden: boolean;
  clientHiddenAt: Date | null;
  processingStatus: string;
  processingError: string | null;
};

export type PhotoManagerSet = "all" | "raw" | "final" | "selected";

function getAdminPreviewUrl(photo: Photo) {
  if (photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl) {
    return photo.thumbnailUrl;
  }

  if (photo.previewUrl && photo.previewUrl !== photo.imageUrl) {
    return photo.previewUrl;
  }

  return photo.imageUrl;
}

function normalizePhotoManagerSet(value: string | null | undefined): PhotoManagerSet {
  if (value === "raw" || value === "final" || value === "selected") {
    return value;
  }

  return "all";
}

export function PhotoManager({
  coverPhotoId,
  galleryId,
  galleryMode,
  photos,
  activeSet = "all",
  selectedPhotoIds = []
}: {
  coverPhotoId: string | null;
  galleryId: string;
  galleryMode: string;
  photos: Photo[];
  activeSet?: string | null;
  selectedPhotoIds?: string[];
}) {
  const proofingGallery = isProofingGallery(galleryMode);
  const selectedSet = new Set(selectedPhotoIds);
  const rawCount = photos.filter((photo) => photo.deliveryStage === PHOTO_DELIVERY_STAGE_RAW).length;
  const finalCount = photos.filter((photo) => photo.deliveryStage === PHOTO_DELIVERY_STAGE_FINAL).length;
  const selectedCount = photos.filter((photo) => selectedSet.has(photo.id)).length;
  const normalizedActiveSet = normalizePhotoManagerSet(activeSet);
  const displayedPhotos = proofingGallery
    ? photos.filter((photo) => {
        if (normalizedActiveSet === "raw") {
          return photo.deliveryStage === PHOTO_DELIVERY_STAGE_RAW;
        }

        if (normalizedActiveSet === "final") {
          return photo.deliveryStage === PHOTO_DELIVERY_STAGE_FINAL;
        }

        if (normalizedActiveSet === "selected") {
          return selectedSet.has(photo.id);
        }

        return true;
      })
    : photos;
  const photoSetTabs = [
    { key: "all", label: "Összes", count: photos.length },
    { key: "raw", label: "Nyers képek", count: rawCount },
    { key: "selected", label: "Ügyfél által kiválasztottak", count: selectedCount },
    { key: "final", label: "Kész képek", count: finalCount }
  ];
  const emptyDescription =
    normalizedActiveSet === "selected"
      ? "Ha az ügyfél leadja a válogatását, itt külön látod majd a kiválasztott képeket."
      : normalizedActiveSet === "final"
        ? "A készre kidolgozott képek ebben a nézetben jelennek meg."
        : normalizedActiveSet === "raw"
          ? "A nyers válogatásra feltöltött képek ebben a nézetben jelennek meg."
          : "Tölts fel képeket, majd itt tudod rendezni őket és borítóképet választani.";

  return (
    <section>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold text-ink">Fotók kezelése</h2>
          <p className="mt-1 text-sm text-graphite/70">
            {proofingGallery
              ? `Rendezés, borítókép választás és egyedi törlés. Nyers: ${rawCount}, kész: ${finalCount}.`
              : "Rendezés, borítókép választás és egyedi törlés."}
          </p>
        </div>
        {photos.length > 1 ? (
          <form action={reorderGalleryPhotosAction.bind(null, galleryId)}>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-3 text-sm font-medium text-graphite transition hover:bg-ink/5 hover:text-ink">
              <Clock3 size={15} />
              Capture time szerint rendezés
            </button>
          </form>
        ) : null}
      </div>
      {proofingGallery ? (
        <nav className="mb-5 grid gap-2 rounded-lg border border-ink/10 bg-white p-2 shadow-soft sm:grid-cols-2 lg:grid-cols-4" aria-label="Fotó készletek">
          {photoSetTabs.map((tab) => {
            const isActive = normalizedActiveSet === tab.key;

            return (
              <Link
                key={tab.key}
                href={`/admin/galleries/${galleryId}?tab=photos&photoSet=${tab.key}`}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
                  isActive ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-xs ${isActive ? "bg-white/15 text-white" : "bg-ink/5 text-graphite"}`}>
                  {tab.count}
                </span>
              </Link>
            );
          })}
        </nav>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayedPhotos.map((photo, index) => (
          <div key={photo.id} className="overflow-hidden rounded-lg border border-ink/10 bg-white">
            <div className="relative aspect-[4/3] bg-mist">
              {photo.mediaType === "video" ? (
                <div className="relative h-full w-full bg-ink">
                  <video src={photo.imageUrl} preload="metadata" muted playsInline className="h-full w-full object-cover opacity-85" />
                  <span className="absolute inset-0 grid place-items-center text-white">
                    <span className="inline-flex items-center gap-2 rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-ink shadow-soft">
                      <Film size={16} />
                      Videó
                    </span>
                  </span>
                </div>
              ) : (
                <Image
                  src={getAdminPreviewUrl(photo)}
                  alt={photo.filename}
                  fill
                  unoptimized
                  loading="lazy"
                  className="object-cover"
                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                />
              )}
              {coverPhotoId === photo.id ? (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-ink">
                  <Star size={13} />
                  Borító
                </span>
              ) : null}
              {proofingGallery ? (
                <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-ink">
                  {photoDeliveryStageLabel(photo.deliveryStage)}
                </span>
              ) : null}
              {photo.isClientHidden ? (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-ink/85 px-2.5 py-1 text-xs font-medium text-white">
                  <EyeOff size={13} />
                  Ügyfél elrejtette
                </span>
              ) : null}
              {photo.processingStatus !== "ready" ? (
                <span className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-graphite">
                  {photo.processingStatus === "failed" ? "Feldolgozás hibás" : "Feldolgozás alatt"}
                </span>
              ) : null}
            </div>
            <div className="space-y-3 p-3">
              <div>
                <p className="truncate text-sm font-medium text-ink">{photo.filename}</p>
                <p className="mt-1 text-xs text-graphite/70">
                  Sorrend: {index + 1}
                  {proofingGallery ? ` · ${photoDeliveryStageLabel(photo.deliveryStage)}` : ""}
                </p>
                {photo.processingError ? (
                  <p className="mt-1 text-xs text-red-700">{photo.processingError}</p>
                ) : null}
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
                    disabled={index === displayedPhotos.length - 1}
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
        {displayedPhotos.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState
              icon={<ImageIcon size={22} />}
              title="Még nincs fotó"
              description={emptyDescription}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
