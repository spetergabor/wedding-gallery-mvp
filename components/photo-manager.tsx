import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp, Clock3, Eye, EyeOff, Film, ImageIcon, Search, Star, Trash2, X } from "lucide-react";
import {
  cleanupDuplicatePhotosAction,
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
  fileSize: number;
  sortOrder: number;
  isClientHidden: boolean;
  clientHiddenAt: Date | null;
  processingStatus: string;
  processingError: string | null;
  processingRequestedAt: Date | null;
};

export type PhotoManagerSet = "all" | "raw" | "final" | "selected";

const STALE_PROCESSING_BADGE_MS = 2 * 60 * 60 * 1000;

function getAdminPreviewUrl(photo: Photo) {
  if (photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl) {
    return photo.thumbnailUrl;
  }

  if (photo.previewUrl && photo.previewUrl !== photo.imageUrl) {
    return photo.previewUrl;
  }

  return photo.imageUrl;
}

function hasProcessedVariant(photo: Photo) {
  return (
    photo.mediaType !== "video" &&
    ((photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl) ||
      (photo.previewUrl && photo.previewUrl !== photo.imageUrl))
  );
}

function shouldShowProcessingBadge(photo: Photo) {
  if (photo.processingStatus === "ready" || hasProcessedVariant(photo)) {
    return false;
  }

  if (
    photo.processingStatus !== "failed" &&
    (!photo.processingRequestedAt ||
      Date.now() - photo.processingRequestedAt.getTime() > STALE_PROCESSING_BADGE_MS)
  ) {
    return false;
  }

  return true;
}

function duplicatePhotoKey(photo: Photo) {
  return [photo.deliveryStage, photo.mediaType === "video" ? "video" : "image", photo.filename.trim(), photo.fileSize ?? 0].join("\u001F");
}

function countDuplicatePhotos(photos: Photo[]) {
  const groups = new Map<string, number>();

  for (const photo of photos) {
    const key = duplicatePhotoKey(photo);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  return [...groups.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
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
  activeSearch = "",
  selectedPhotoIds = []
}: {
  coverPhotoId: string | null;
  galleryId: string;
  galleryMode: string;
  photos: Photo[];
  activeSet?: string | null;
  activeSearch?: string | null;
  selectedPhotoIds?: string[];
}) {
  const proofingGallery = isProofingGallery(galleryMode);
  const selectedSet = new Set(selectedPhotoIds);
  const rawCount = photos.filter((photo) => photo.deliveryStage === PHOTO_DELIVERY_STAGE_RAW).length;
  const finalCount = photos.filter((photo) => photo.deliveryStage === PHOTO_DELIVERY_STAGE_FINAL).length;
  const selectedCount = photos.filter((photo) => selectedSet.has(photo.id)).length;
  const duplicateCount = countDuplicatePhotos(photos);
  const normalizedActiveSet = normalizePhotoManagerSet(activeSet);
  const normalizedSearch = (activeSearch ?? "").trim();
  const basePhotos = proofingGallery
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
  const displayedPhotos = normalizedSearch
    ? basePhotos.filter((photo) => photo.filename.toLowerCase().includes(normalizedSearch.toLowerCase()))
    : basePhotos;
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
  const photoSetQueryPart = proofingGallery ? `&photoSet=${normalizedActiveSet}` : "";
  const searchQueryPart = normalizedSearch ? `&photoSearch=${encodeURIComponent(normalizedSearch)}` : "";

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
        <div className="flex flex-wrap gap-2">
          {duplicateCount > 0 ? (
            <form action={cleanupDuplicatePhotosAction.bind(null, galleryId)}>
              <ConfirmSubmitButton
                message={`Biztosan törlöd a ${duplicateCount} duplikált fotót? A rendszer a legrégebbi példányt tartja meg.`}
                variant="danger"
                className="h-10 px-3"
              >
                <Trash2 size={15} />
                {duplicateCount} duplikátum törlése
              </ConfirmSubmitButton>
            </form>
          ) : null}
          {photos.length > 1 ? (
            <form action={reorderGalleryPhotosAction.bind(null, galleryId)}>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-3 text-sm font-medium text-graphite transition hover:bg-ink/5 hover:text-ink">
                <Clock3 size={15} />
                Capture time szerint rendezés
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {proofingGallery ? (
        <nav className="mb-5 grid gap-2 rounded-lg border border-ink/10 bg-white p-2 shadow-soft sm:grid-cols-2 lg:grid-cols-4" aria-label="Fotó készletek">
          {photoSetTabs.map((tab) => {
            const isActive = normalizedActiveSet === tab.key;

            return (
              <Link
                key={tab.key}
                href={`/admin/galleries/${galleryId}?tab=photos&photoSet=${tab.key}${searchQueryPart}`}
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
      <form method="get" className="mb-5 rounded-lg border border-ink/10 bg-white p-3 shadow-soft">
        <input type="hidden" name="tab" value="photos" />
        {proofingGallery ? <input type="hidden" name="photoSet" value={normalizedActiveSet} /> : null}
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <label className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite/50" />
            <input
              type="search"
              name="photoSearch"
              defaultValue={normalizedSearch}
              placeholder="Keresés fájlnév alapján..."
              className="h-11 w-full rounded-md border border-ink/15 bg-white pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
            >
              <Search size={16} />
              Keresés
            </button>
            {normalizedSearch ? (
              <Link
                href={`/admin/galleries/${galleryId}?tab=photos${photoSetQueryPart}`}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-graphite transition hover:border-ink/30"
              >
                <X size={16} />
                Törlés
              </Link>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-xs text-graphite/70">
          {normalizedSearch
            ? `${displayedPhotos.length} találat / ${basePhotos.length} kép ebben a nézetben.`
            : `${basePhotos.length} kép ebben a nézetben.`}
        </p>
      </form>
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
              {shouldShowProcessingBadge(photo) ? (
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
              title={normalizedSearch ? "Nincs találat" : "Még nincs fotó"}
              description={normalizedSearch ? "Próbálj teljes vagy részleges fájlnevet keresni, például SP2_4439 vagy DJI_0018." : emptyDescription}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
