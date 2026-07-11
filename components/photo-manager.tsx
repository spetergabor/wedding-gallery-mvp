import Link from "next/link";
import { Clock3, Search, Trash2, X } from "lucide-react";
import {
  cleanupDuplicatePhotosAction,
  reorderGalleryPhotosAction
} from "@/lib/gallery-actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PhotoSortableGrid, type PhotoManagerSet, type SortablePhoto } from "@/components/photo-sortable-grid";
import {
  PHOTO_DELIVERY_STAGE_FINAL,
  PHOTO_DELIVERY_STAGE_RAW,
  isProofingGallery
} from "@/lib/proofing";

function duplicatePhotoKey(photo: SortablePhoto) {
  return [photo.deliveryStage, photo.mediaType === "video" ? "video" : "image", photo.filename.trim(), photo.fileSize ?? 0].join("\u001F");
}

function countDuplicatePhotos(photos: SortablePhoto[]) {
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
  sections = [],
  activeSet = "all",
  activeSearch = "",
  selectedPhotoIds = []
}: {
  coverPhotoId: string | null;
  galleryId: string;
  galleryMode: string;
  photos: SortablePhoto[];
  sections?: Array<{ id: string; title: string }>;
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
              <FormSubmitButton
                variant="secondary"
                className="inline-flex h-10 items-center justify-center gap-2 border border-ink/10 px-3 text-sm text-graphite"
                pendingLabel="Rendezés..."
              >
                <Clock3 size={15} />
                Capture time szerint rendezés
              </FormSubmitButton>
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
      <PhotoSortableGrid
        activeSearch={normalizedSearch}
        activeSet={normalizedActiveSet}
        coverPhotoId={coverPhotoId}
        emptyDescription={emptyDescription}
        galleryId={galleryId}
        galleryMode={galleryMode}
        photos={photos}
        sections={sections}
        selectedPhotoIds={selectedPhotoIds}
      />
    </section>
  );
}
