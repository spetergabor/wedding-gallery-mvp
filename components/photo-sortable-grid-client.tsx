"use client";

import dynamic from "next/dynamic";
import type { PhotoSortableGridProps } from "@/components/photo-sortable-grid";

const DynamicPhotoSortableGrid = dynamic(
  () => import("@/components/photo-sortable-grid").then((module) => module.PhotoSortableGrid),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-ink/10 bg-white px-5 py-8 text-center shadow-soft">
        <p className="text-sm font-medium text-ink">Képek kezelőfelületének betöltése…</p>
        <p className="mt-1 text-xs text-graphite/65">Nagy galériánál ez néhány másodpercig tarthat.</p>
      </div>
    )
  }
);

export function PhotoSortableGridClient(props: PhotoSortableGridProps) {
  return <DynamicPhotoSortableGrid {...props} />;
}
