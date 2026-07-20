"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutTemplate, Upload } from "lucide-react";

type AlbumMode = "editor" | "upload";

type AlbumWorkflowTabsProps = {
  initialMode: AlbumMode;
  initialOpen: boolean;
  backHref: string;
  requireAlbumTab?: boolean;
  dashboardContent: ReactNode;
  editorContent: ReactNode;
  uploadContent: ReactNode;
};

const workflowKeys = [
  "albumMode",
  "albumWorkspace",
  "albumDesignId",
  "albumEditor",
  "albumActiveSpread",
  "albumCreated",
  "albumDeleted",
  "albumUpdated",
  "albumUploaded",
  "albumError",
  "albumDesignCreated",
  "albumDesignDeleted",
  "albumDesignUpdated",
  "albumDesignExported",
  "albumDesignError",
  "albumSpreadAutoCreated",
  "albumSpreadCreated",
  "albumSpreadRegenerated",
  "albumSpreadUpdated",
  "albumSpreadSlotUpdated",
  "albumSpreadDeleted"
] as const;

function hasAlbumWorkflowParams(params: Pick<URLSearchParams, "has">) {
  return workflowKeys.some((key) => params.has(key));
}

const modeCopy: Record<AlbumMode, { title: string; description: string; icon: typeof LayoutTemplate }> = {
  editor: {
    title: "Online album",
    description: "Albumterv készítése és szerkesztése Spetlyben.",
    icon: LayoutTemplate
  },
  upload: {
    title: "Feltöltött ellenőrző",
    description: "Külső programból exportált oldalpárok ügyfél-ellenőrzése.",
    icon: Upload
  }
};

export function AlbumWorkflowTabs({
  initialMode,
  initialOpen,
  backHref,
  requireAlbumTab = true,
  dashboardContent,
  editorContent,
  uploadContent
}: AlbumWorkflowTabsProps) {
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();
  const tabParam = searchParams.get("tab");
  const albumModeParam = searchParams.get("albumMode");
  const [mode, setMode] = useState<AlbumMode>(initialMode);
  const [isOpen, setIsOpen] = useState(initialOpen);

  useEffect(() => {
    if (requireAlbumTab && tabParam !== "album") {
      return;
    }

    const nextParams = new URLSearchParams(searchString);
    setMode(albumModeParam === "upload" ? "upload" : "editor");
    setIsOpen(hasAlbumWorkflowParams(nextParams));
  }, [albumModeParam, requireAlbumTab, searchString, tabParam]);

  if (!isOpen) {
    return <>{dashboardContent}</>;
  }

  const activeCopy = modeCopy[mode];
  const ActiveIcon = activeCopy.icon;

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-ink/10 bg-paper px-4 py-3 shadow-soft">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-ink shadow-sm">
              <ActiveIcon size={17} />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-brass">Album munkafolyamat</p>
              <h2 className="text-base font-semibold text-ink">{activeCopy.title}</h2>
              <p className="text-sm text-graphite/65">{activeCopy.description}</p>
            </div>
          </div>
          <Link
            href={backHref}
            className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/30"
          >
            <ArrowLeft size={15} />
            Vissza az albumokhoz
          </Link>
        </div>
      </section>

      <div hidden={mode !== "editor"}>{editorContent}</div>
      <div hidden={mode !== "upload"}>{uploadContent}</div>
    </div>
  );
}
