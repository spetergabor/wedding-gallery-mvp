"use client";

import { ReactNode, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ImagePlus, LayoutTemplate, Upload } from "lucide-react";

type AlbumMode = "editor" | "upload";

type AlbumWorkflowTabsProps = {
  initialMode: AlbumMode;
  editorCount: number;
  reviewCount: number;
  editorContent: ReactNode;
  uploadContent: ReactNode;
};

function updateAlbumModeUrl(mode: AlbumMode) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "album");
  url.searchParams.set("albumMode", mode);
  window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
}

export function AlbumWorkflowTabs({
  initialMode,
  editorCount,
  reviewCount,
  editorContent,
  uploadContent
}: AlbumWorkflowTabsProps) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const albumModeParam = searchParams.get("albumMode");
  const [mode, setMode] = useState<AlbumMode>(initialMode);

  useEffect(() => {
    if (tabParam !== "album") {
      return;
    }

    setMode(albumModeParam === "upload" ? "upload" : "editor");
  }, [albumModeParam, tabParam]);

  function selectMode(nextMode: AlbumMode) {
    setMode(nextMode);
    updateAlbumModeUrl(nextMode);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
              <ImagePlus size={15} />
              Album workflow
            </div>
            <h2 className="mt-2 text-xl font-semibold text-ink">Albumterv indítása</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
              Válaszd ki, hogy az appon belül építed fel az oldalpárokat, vagy egy külső programból exportált albumtervet töltesz fel ellenőrzésre.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[560px]">
            <button
              type="button"
              aria-pressed={mode === "editor"}
              onClick={() => selectMode("editor")}
              className={`rounded-md border p-4 text-left transition ${
                mode === "editor" ? "border-ink bg-ink text-white shadow-soft" : "border-ink/10 bg-paper text-ink hover:border-ink/25"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <LayoutTemplate size={16} />
                Beépített szerkesztő
              </span>
              <span className={`mt-1 block text-xs leading-5 ${mode === "editor" ? "text-white/70" : "text-graphite/65"}`}>
                Favorite listából automatikus oldalpárok és JPG export.
              </span>
              <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${mode === "editor" ? "bg-white/15 text-white" : "bg-ink/5 text-graphite"}`}>
                {editorCount} albumterv
              </span>
            </button>
            <button
              type="button"
              aria-pressed={mode === "upload"}
              onClick={() => selectMode("upload")}
              className={`rounded-md border p-4 text-left transition ${
                mode === "upload" ? "border-ink bg-ink text-white shadow-soft" : "border-ink/10 bg-paper text-ink hover:border-ink/25"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Upload size={16} />
                Egyéni albumterv feltöltése
              </span>
              <span className={`mt-1 block text-xs leading-5 ${mode === "upload" ? "text-white/70" : "text-graphite/65"}`}>
                SmartAlbumsból vagy máshonnan exportált JPG oldalpárok ellenőrzése.
              </span>
              <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${mode === "upload" ? "bg-white/15 text-white" : "bg-ink/5 text-graphite"}`}>
                {reviewCount} ellenőrző
              </span>
            </button>
          </div>
        </div>
      </section>

      <div hidden={mode !== "editor"}>{editorContent}</div>
      <div hidden={mode !== "upload"}>{uploadContent}</div>
    </div>
  );
}
