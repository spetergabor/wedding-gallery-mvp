"use client";

import { ReactNode, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutTemplate, Upload } from "lucide-react";

type AlbumMode = "editor" | "upload";

type AlbumWorkflowTabsProps = {
  initialMode: AlbumMode;
  editorCount: number;
  reviewCount: number;
  dashboardContent: ReactNode;
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
  dashboardContent,
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
    <div className="space-y-5">
      <section className="rounded-lg border border-ink/10 bg-white p-3 shadow-soft">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-semibold text-ink">Munkaterület</p>
            <p className="mt-1 text-xs text-graphite/65">Válts a beépített szerkesztő és a külső ellenőrzők kezelése között.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[520px]">
            <button
              type="button"
              aria-pressed={mode === "editor"}
              onClick={() => selectMode("editor")}
              className={`rounded-md border px-4 py-3 text-left transition ${
                mode === "editor" ? "border-ink bg-ink text-white shadow-soft" : "border-ink/10 bg-paper text-ink hover:border-ink/25"
              }`}
            >
              <span className="flex items-center justify-between gap-3 text-sm font-semibold">
                <span className="inline-flex items-center gap-2">
                  <LayoutTemplate size={16} />
                  Beépített szerkesztő
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${mode === "editor" ? "bg-white/15 text-white" : "bg-ink/5 text-graphite"}`}>
                  {editorCount}
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-pressed={mode === "upload"}
              onClick={() => selectMode("upload")}
              className={`rounded-md border px-4 py-3 text-left transition ${
                mode === "upload" ? "border-ink bg-ink text-white shadow-soft" : "border-ink/10 bg-paper text-ink hover:border-ink/25"
              }`}
            >
              <span className="flex items-center justify-between gap-3 text-sm font-semibold">
                <span className="inline-flex items-center gap-2">
                  <Upload size={16} />
                  Feltöltött ellenőrzők
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${mode === "upload" ? "bg-white/15 text-white" : "bg-ink/5 text-graphite"}`}>
                  {reviewCount}
                </span>
              </span>
            </button>
          </div>
        </div>
      </section>

      <div hidden={mode !== "editor"}>{editorContent}</div>
      <div hidden={mode !== "upload"}>{uploadContent}</div>

      {dashboardContent}
    </div>
  );
}
